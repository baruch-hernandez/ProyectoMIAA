package com.miaa.lecturas.services;

import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * "Olvidé mi contraseña": un código de 6 dígitos al correo de la cuenta, válido 15 minutos y con
 * 5 intentos. Sirve igual en la web (admin) y en la app (notificador), sin enlaces.
 *
 * Nunca dice si un usuario existe o tiene correo: pedir el código siempre responde lo mismo, y un
 * código equivocado o vencido da el mismo error que un usuario inexistente.
 */
@Service
public class RecuperacionPasswordService {

    private static final Logger log = LoggerFactory.getLogger(RecuperacionPasswordService.class);

    static final Duration VIGENCIA = Duration.ofMinutes(15);
    static final int INTENTOS_MAXIMOS = 5;
    /** Entre un código y otro para la misma cuenta: que nadie llene de correos a otra persona. */
    static final Duration ESPERA_REENVIO = Duration.ofMinutes(1);

    private static final SecureRandom AZAR = new SecureRandom();

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final ObjectProvider<JavaMailSender> correo;
    private final String remitente;

    public RecuperacionPasswordService(UsuarioRepository usuarios, PasswordEncoder encoder,
                                       ObjectProvider<JavaMailSender> correo,
                                       @Value("${miaa.correo.remitente:no-responder@miaa.gob.mx}") String remitente) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.correo = correo;
        this.remitente = remitente;
    }

    @Transactional
    public void solicitar(String identificador, LocalDateTime ahora) {
        Optional<Usuario> cuenta = buscar(identificador);
        if (cuenta.isEmpty()) return;
        Usuario u = cuenta.get();
        if (!u.estaHabilitado() || u.getEmail() == null || u.getEmail().isBlank()) return;
        if (u.getResetExpira() != null && u.getResetExpira().minus(VIGENCIA).plus(ESPERA_REENVIO).isAfter(ahora)) return;

        String codigo = "%06d".formatted(AZAR.nextInt(1_000_000));
        u.setResetCodigoHash(encoder.encode(codigo));
        u.setResetExpira(ahora.plus(VIGENCIA));
        u.setResetIntentos(0);
        alConfirmar(() -> enviar(u.getEmail(), u.getNombre(), codigo));
    }

    // noRollbackFor: un código equivocado debe CONTAR como intento aunque se responda con error
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public void restablecer(String identificador, String codigo, String nueva, LocalDateTime ahora) {
        PoliticaPassword.validar(nueva); // antes del código: una contraseña débil no gasta intentos
        Usuario u = buscar(identificador).orElseThrow(RecuperacionPasswordService::invalido);
        if (u.getResetCodigoHash() == null || u.getResetExpira() == null || !u.getResetExpira().isAfter(ahora)) {
            throw invalido();
        }
        if (codigo == null || !encoder.matches(codigo.trim(), u.getResetCodigoHash())) {
            int intentos = (u.getResetIntentos() == null ? 0 : u.getResetIntentos()) + 1;
            u.setResetIntentos(intentos);
            if (intentos >= INTENTOS_MAXIMOS) olvidarCodigo(u);
            throw invalido();
        }
        u.setPassword(encoder.encode(nueva));
        u.setDebeCambiarPassword(false); // la eligió la persona: ya no es temporal
        BloqueoPorIntentos.desbloquear(u);
        olvidarCodigo(u);
    }

    /** Igual que el login: por usuario o por correo, sin importar mayúsculas, con la fila bloqueada. */
    private Optional<Usuario> buscar(String identificador) {
        if (identificador == null || identificador.isBlank()) return Optional.empty();
        String id = identificador.trim();
        Optional<Usuario> u = usuarios.findParaLoginByUsernameIgnoreCase(id);
        return u.isPresent() ? u : usuarios.findParaLoginByEmailIgnoreCase(id);
    }

    private static void olvidarCodigo(Usuario u) {
        u.setResetCodigoHash(null);
        u.setResetExpira(null);
        u.setResetIntentos(null);
    }

    private static ResponseStatusException invalido() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "El código no es correcto o ya venció. Pide uno nuevo.");
    }

    /**
     * El correo sale después del COMMIT y sin hacer esperar la respuesta: si tardara solo cuando la
     * cuenta existe, el tiempo de respuesta delataría qué usuarios hay.
     */
    private static void alConfirmar(Runnable accion) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    CompletableFuture.runAsync(accion);
                }
            });
        } else {
            accion.run(); // pruebas unitarias, sin transacción
        }
    }

    void enviar(String para, String nombre, String codigo) {
        JavaMailSender servidor = correo.getIfAvailable();
        if (servidor == null) {
            // shortcut: sin servidor de correo (desarrollo) el código sale en el log; en producción definan SPRING_MAIL_HOST
            log.warn("Sin servidor de correo configurado. Código para restablecer la contraseña de {}: {}", para, codigo);
            return;
        }
        SimpleMailMessage m = new SimpleMailMessage();
        m.setFrom(remitente);
        m.setTo(para);
        m.setSubject("MIAA: código para restablecer tu contraseña");
        m.setText("""
                Hola %s:

                Tu código para restablecer la contraseña es: %s

                Vence en %d minutos. Escríbelo en la pantalla "¿Olvidaste tu contraseña?" de MIAA.
                Si tú no lo pediste, ignora este correo: tu contraseña no ha cambiado.
                """.formatted(nombre, codigo, VIGENCIA.toMinutes()));
        try {
            servidor.send(m);
        } catch (MailException e) {
            log.error("No se pudo mandar el código de restablecimiento a {}: {}", para, e.getMessage());
        }
    }
}

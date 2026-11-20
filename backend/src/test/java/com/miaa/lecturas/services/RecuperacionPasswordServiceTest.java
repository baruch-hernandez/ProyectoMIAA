package com.miaa.lecturas.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;

/** "Olvidé mi contraseña": el código llega al correo, vence, se acaba y no delata cuentas. */
@SuppressWarnings({ "null", "unchecked" })
class RecuperacionPasswordServiceTest {

    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 11, 20, 10, 0);

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private JavaMailSender correo;
    private Usuario juan;
    private RecuperacionPasswordService servicio;

    @BeforeEach
    void preparar() {
        juan = new Usuario();
        juan.setNombre("Juan");
        juan.setUsername("juan");
        juan.setEmail("juan@miaa.gob.mx");
        juan.setPassword(encoder.encode("vieja123"));
        juan.setDebeCambiarPassword(true);
        juan.setIntentosFallidos(3);
        juan.setBloqueadoHasta(AHORA.plusMinutes(10));
        UsuarioRepository usuarios = mock(UsuarioRepository.class);
        when(usuarios.findParaLoginByUsernameIgnoreCase("juan")).thenReturn(Optional.of(juan));
        correo = mock(JavaMailSender.class);
        ObjectProvider<JavaMailSender> proveedor = mock(ObjectProvider.class);
        when(proveedor.getIfAvailable()).thenReturn(correo);
        servicio = new RecuperacionPasswordService(usuarios, encoder, proveedor, "no-responder@miaa.gob.mx");
    }

    /** Pide el código y lo saca del correo que se mandó. */
    private String codigoDelCorreo() {
        servicio.solicitar("juan", AHORA);
        ArgumentCaptor<SimpleMailMessage> m = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(correo).send(m.capture());
        assertEquals("juan@miaa.gob.mx", m.getValue().getTo()[0]);
        return m.getValue().getText().replaceAll("(?s).*es: (\\d{6}).*", "$1");
    }

    @Test
    void conElCodigoDelCorreoCambiaLaContrasenaYQuitaElBloqueo() {
        String codigo = codigoDelCorreo();
        assertFalse(juan.getResetCodigoHash().contains(codigo), "en la base solo va el hash");

        servicio.restablecer("juan", codigo, "nueva456", AHORA.plusMinutes(5));

        assertTrue(encoder.matches("nueva456", juan.getPassword()));
        assertFalse(juan.tieneQueCambiarPassword());
        assertNull(juan.getBloqueadoHasta());
        assertNull(juan.getResetCodigoHash(), "el código ya no sirve otra vez");
    }

    @Test
    void elCodigoVenceALos15Minutos() {
        String codigo = codigoDelCorreo();
        assertThrows(ResponseStatusException.class,
                () -> servicio.restablecer("juan", codigo, "nueva456", AHORA.plusMinutes(15)));
    }

    @Test
    void cincoCodigosEquivocadosLoInvalidan() {
        String codigo = codigoDelCorreo();
        String otro = codigo.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < RecuperacionPasswordService.INTENTOS_MAXIMOS; i++) {
            assertThrows(ResponseStatusException.class, () -> servicio.restablecer("juan", otro, "nueva456", AHORA));
        }
        assertThrows(ResponseStatusException.class, () -> servicio.restablecer("juan", codigo, "nueva456", AHORA),
                "ni el correcto sirve después de 5 fallos");
        assertTrue(encoder.matches("vieja123", juan.getPassword()));
    }

    @Test
    void unaContrasenaDebilNoGastaIntentos() {
        String codigo = codigoDelCorreo();
        assertThrows(ResponseStatusException.class, () -> servicio.restablecer("juan", codigo, "corta", AHORA));
        servicio.restablecer("juan", codigo, "nueva456", AHORA);
        assertTrue(encoder.matches("nueva456", juan.getPassword()));
    }

    @Test
    void noDelataCuentasNiLlenaElCorreoDeNadie() {
        servicio.solicitar("nadie", AHORA); // no existe: sin error y sin correo
        juan.setEmail(null);
        servicio.solicitar("juan", AHORA); // sin correo: igual
        verify(correo, never()).send(any(SimpleMailMessage.class));
        assertThrows(ResponseStatusException.class, () -> servicio.restablecer("nadie", "123456", "nueva456", AHORA));

        juan.setEmail("juan@miaa.gob.mx");
        servicio.solicitar("juan", AHORA);
        servicio.solicitar("juan", AHORA.plusSeconds(30)); // otro antes de 1 min: no se manda
        verify(correo, times(1)).send(any(SimpleMailMessage.class));
    }
}

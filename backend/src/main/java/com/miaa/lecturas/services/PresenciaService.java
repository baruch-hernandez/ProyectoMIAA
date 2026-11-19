package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.dtos.UbicacionRequestDTO;
import com.miaa.lecturas.entities.EstadoConexion;
import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.entities.UsuarioPresencia;
import com.miaa.lecturas.repositories.UsuarioPresenciaRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Presencia y ubicación en vivo, en una sola fila por empleado (UsuarioPresencia).
 *
 *  1. Mientras la sesión está abierta, la app manda un latido cada segundo (POST /heartbeat),
 *     con las coordenadas si las tiene: ACTIVO y última conexión = ahora.
 *  2. Al cerrar sesión o pausarse la app: INACTIVO al instante (se conserva el último punto).
 *  3. Si los latidos dejan de llegar (sin red, celular apagado), la tarea programada lo marca
 *     INACTIVO al pasar miaa.presencia.segundos-en-linea. Al leer también se revisa el tiempo, así
 *     el admin nunca ve "ACTIVO" a alguien sin latido aunque la tarea aún no haya pasado.
 */
@Service
public class PresenciaService {

    private final UsuarioPresenciaRepository presencias;
    private final UsuarioRepository usuarios;
    private final LimiteAguascalientes limiteAgs;
    private final GeocodificadorInverso geocodificador;
    private final long segundosEnLinea;
    private final long segundosUbicacion;

    public PresenciaService(UsuarioPresenciaRepository presencias, UsuarioRepository usuarios,
                            LimiteAguascalientes limiteAgs, GeocodificadorInverso geocodificador,
                            @Value("${miaa.presencia.segundos-en-linea}") long segundosEnLinea,
                            @Value("${miaa.ubicacion.segundos-en-linea:45}") long segundosUbicacion) {
        this.presencias = presencias;
        this.usuarios = usuarios;
        this.limiteAgs = limiteAgs;
        this.geocodificador = geocodificador;
        this.segundosEnLinea = segundosEnLinea;
        this.segundosUbicacion = segundosUbicacion;
    }

    /** "sigo aquí", con o sin coordenadas. Fuera de Aguascalientes → 400 y no cambia nada. */
    @Transactional
    public void latido(long usuarioId, UbicacionRequestDTO ubicacion) {
        if (ubicacion != null && !limiteAgs.contiene(ubicacion.latitud(), ubicacion.longitud())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La ubicación está fuera del estado de Aguascalientes");
        }
        Instant ahora = Instant.now();
        UsuarioPresencia p = presencias.findById(usuarioId).orElseGet(() -> {
            UsuarioPresencia nueva = new UsuarioPresencia();
            nueva.setUsuarioId(usuarioId);
            return nueva;
        });
        p.setUltimaConexionUtc(ahora);
        p.setEstadoConexion(EstadoConexion.ACTIVO);
        if (ubicacion != null) {
            p.setUltimaLatitud(ubicacion.latitud());
            p.setUltimaLongitud(ubicacion.longitud());
            p.setPrecisionMetros(ubicacion.precision());
            p.setFechaUbicacionUtc(ahora);
        }
        presencias.save(p);
        if (ubicacion != null) {
            geocodificador.solicitar(usuarioId, ubicacion.latitud(), ubicacion.longitud());
        }
    }

    /** Cerró sesión, la app se pausó o el admin lo dio de baja: INACTIVO al instante. */
    @Transactional
    public void desconectar(long usuarioId) {
        // Sin save(): la entidad está administrada y JPA guarda el cambio solo (dirty checking).
        presencias.findById(usuarioId).ifPresent(p -> p.setEstadoConexion(EstadoConexion.INACTIVO));
    }

    /** Los que dejaron de mandar latido pasan a INACTIVO (una sola consulta UPDATE). */
    @Scheduled(fixedDelayString = "${miaa.presencia.revisar-cada-ms:1000}")
    public void marcarInactivosSinLatido() {
        presencias.marcarInactivos(Instant.now().minusSeconds(segundosEnLinea),
                EstadoConexion.ACTIVO, EstadoConexion.INACTIVO);
    }

    /** Todos los notificadores habilitados, con o sin ubicación (dos consultas). */
    @Transactional(readOnly = true)
    public List<UbicacionEmpleadoDTO> cuadrillas() {
        Instant ahora = Instant.now();
        Map<Long, UsuarioPresencia> porUsuario = porUsuario();
        return usuarios.findByRolOrderByNombreAsc(Rol.NOTIFICADOR).stream()
                .filter(u -> u.estaHabilitado())
                .map(e -> armar(e, porUsuario.get(e.getId()), ahora, segundosEnLinea))
                .toList();
    }

    @Transactional(readOnly = true)
    public UbicacionEmpleadoDTO deEmpleado(long empleadoId) {
        Usuario empleado = usuarios.findById(empleadoId)
                .filter(u -> u.getRol() != null) // notificadores y administradores (estos casi nunca comparten)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ese empleado no existe"));
        return armar(empleado, presencias.findById(empleadoId).orElse(null), Instant.now(), segundosEnLinea);
    }

    /** Para la tabla de empleados: la presencia de todos en una sola consulta. */
    @Transactional(readOnly = true)
    public Map<Long, UsuarioPresencia> porUsuario() {
        return presencias.findAll().stream().collect(Collectors.toMap(p -> p.getUsuarioId(), Function.identity()));
    }

    public boolean activo(UsuarioPresencia p) {
        return activo(p, Instant.now(), segundosEnLinea);
    }

    /** Activo y con una ubicación reciente (la app manda las coordenadas al moverse o cada 30 s). */
    public boolean compartiendoUbicacion(UsuarioPresencia p) {
        Instant ahora = Instant.now();
        return activo(p, ahora, segundosEnLinea) && p.getFechaUbicacionUtc() != null
                && !p.getFechaUbicacionUtc().isBefore(ahora.minusSeconds(segundosUbicacion));
    }

    static boolean activo(UsuarioPresencia p, Instant ahora, long segundos) {
        return p != null && p.getEstadoConexion() == EstadoConexion.ACTIVO && p.getUltimaConexionUtc() != null
                && !p.getUltimaConexionUtc().isBefore(ahora.minusSeconds(segundos));
    }

    static UbicacionEmpleadoDTO armar(Usuario e, UsuarioPresencia p, Instant ahora, long segundosEnLinea) {
        boolean activo = activo(p, ahora, segundosEnLinea);
        // punto = la presencia, solo si tiene coordenadas (null = nunca ha compartido ubicación)
        UsuarioPresencia punto = p != null && p.getUltimaLatitud() != null && p.getUltimaLongitud() != null ? p : null;
        Instant fechaPunto = punto == null ? null : punto.getFechaUbicacionUtc();
        Long segundos = fechaPunto == null ? null : Math.max(0, Duration.between(fechaPunto, ahora).getSeconds());
        return new UbicacionEmpleadoDTO(e.getId(), e.getNombre(), e.getUsername(), e.getRol(),
                activo ? EstadoConexion.ACTIVO : EstadoConexion.INACTIVO, activo, punto != null,
                punto == null ? null : punto.getUltimaLatitud(), punto == null ? null : punto.getUltimaLongitud(),
                punto == null ? null : punto.getPrecisionMetros(), punto == null ? null : punto.getDireccionGeocodificada(),
                p == null ? null : p.getUltimaConexionUtc(), fechaPunto,
                segundos, segundosEnLinea);
    }
}

package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.EmpleadoDTO;
import com.miaa.lecturas.dtos.EmpleadosDTO;
import com.miaa.lecturas.entities.Disponibilidad;
import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.entities.UsuarioPresencia;
import com.miaa.lecturas.repositories.ReporteRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ¿El empleado está ACTIVO o INACTIVO? Sale de la presencia, no de días de actividad:
 * ACTIVO con la sesión iniciada y latidos llegando; INACTIVO si cerró sesión o dejaron de
 * llegar (pantalla o celular apagados, app al fondo o sin señal). Ver PresenciaService.
 */
@Service
public class EmpleadoService {

    private final PresenciaService presenciaService;
    private final UsuarioRepository usuarioRepository;
    private final ReporteRepository reporteRepository;

    public EmpleadoService(UsuarioRepository usuarioRepository,
            ReporteRepository reporteRepository,
            PresenciaService presenciaService) {
        this.usuarioRepository = usuarioRepository;
        this.reporteRepository = reporteRepository;
        this.presenciaService = presenciaService;
    }

    /**
     * La tabla del admin se pide CADA SEGUNDO (por el estado ACTIVO/INACTIVO), pero los conteos de
     * reportes recorren toda la tabla de reportes y cambian poco: se reusan hasta este tiempo.
     */
    static final long MS_ESTADISTICAS = 30_000;

    private volatile Map<Long, Object[]> estadisticas;
    private volatile long estadisticasEnMs;

    /** [usuarioId → (usuarioId, totalReportes, fechaUltimoReporte)]; un reporte nuevo tarda hasta 30 s en contarse. */
    private Map<Long, Object[]> estadisticas() {
        long ahora = System.currentTimeMillis();
        if (estadisticas == null || ahora - estadisticasEnMs >= MS_ESTADISTICAS) {
            Map<Long, Object[]> nuevas = new HashMap<>();
            for (Object[] fila : reporteRepository.estadisticasPorUsuario()) {
                nuevas.put((Long) fila[0], fila);
            }
            estadisticas = nuevas; // si dos peticiones la recalculan a la vez, gana cualquiera: dan lo mismo
            estadisticasEnMs = ahora;
        }
        return estadisticas;
    }

    @Transactional(readOnly = true)
    public EmpleadosDTO listar() {
        Map<Long, Object[]> stats = estadisticas();

        Map<Long, UsuarioPresencia> presencias = presenciaService.porUsuario();
        LocalDateTime ahora = LocalDateTime.now();
        // Notificadores y administradores (el admin ahora da de alta a ambos)
        List<EmpleadoDTO> empleados = java.util.stream.Stream.concat(
                        usuarioRepository.findByRolOrderByNombreAsc(Rol.NOTIFICADOR).stream(),
                        usuarioRepository.findByRolOrderByNombreAsc(Rol.ADMIN).stream())
                .sorted(java.util.Comparator.comparing((Usuario u) -> u.getNombre(),
                        java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(u -> {
                    Object[] s = stats.get(u.getId());
                    long total = s != null ? (Long) s[1] : 0L;
                    LocalDateTime ultimoReporte = s != null ? (LocalDateTime) s[2] : null;
                    UsuarioPresencia p = presencias.get(u.getId());
                    return armar(u, total, ultimoReporte, ahora, presenciaService.compartiendoUbicacion(p),
                            presenciaService.activo(p) ? Disponibilidad.EN_LINEA : Disponibilidad.DESCONECTADO,
                            p == null ? null : p.getUltimaConexionUtc());
                })
                // Los dados de baja al final (mismo orden por nombre dentro de cada grupo)
                .sorted(java.util.Comparator.comparing(e -> !e.habilitado()))
                .toList();
        return new EmpleadosDTO(empleados);
    }

    /**
     * Lógica pura (sin BD): fácil de probar con cualquier fecha.
     */
    static EmpleadoDTO armar(Usuario u, long totalReportes, LocalDateTime ultimoReporte,
            LocalDateTime ahora, boolean enLinea,
            Disponibilidad disponibilidad, Instant ultimaConexion) {
        LocalDateTime ultimaActividad = masReciente(u.getUltimoAcceso(), ultimoReporte);
        Long dias = ultimaActividad == null ? null : Math.max(0, Duration.between(ultimaActividad, ahora).toDays());
        // Un empleado dado de baja nunca cuenta como activo
        Disponibilidad estado = u.estaHabilitado() ? disponibilidad : Disponibilidad.DESCONECTADO;
        return new EmpleadoDTO(u.getId(), u.getNombre(), u.getUsername(), u.getUltimoAcceso(),
                ultimoReporte, totalReportes, ultimaActividad, estado == Disponibilidad.EN_LINEA, dias, enLinea,
                u.estaHabilitado(), estado, ultimaConexion, u.getRol());
    }

    private static LocalDateTime masReciente(LocalDateTime a, LocalDateTime b) {
        if (a == null)
            return b;
        if (b == null)
            return a;
        return a.isAfter(b) ? a : b;
    }
}

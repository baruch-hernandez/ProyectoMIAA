package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.EmpleadoDTO;
import com.miaa.lecturas.dtos.EmpleadosDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.ReporteRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ¿El empleado está ACTIVO o INACTIVO? (lo pidió el administrador)
 *
 * Regla "por actividad": está ACTIVO si inició sesión o subió un reporte en los
 * últimos N días. Si no, INACTIVO. Nadie tiene que marcarlo a mano: se calcula solo.
 *
 * N se cambia en application.properties:  miaa.empleados.dias-inactivo=7
 */
@Service
public class EmpleadoService {

    private final UsuarioRepository usuarioRepository;
    private final ReporteRepository reporteRepository;
    private final UbicacionService ubicacionService;
    private final int diasInactivo;

    public EmpleadoService(UsuarioRepository usuarioRepository,
                           ReporteRepository reporteRepository,
                           UbicacionService ubicacionService,
                           @Value("${miaa.empleados.dias-inactivo:7}") int diasInactivo) {
        this.usuarioRepository = usuarioRepository;
        this.reporteRepository = reporteRepository;
        this.ubicacionService = ubicacionService;
        this.diasInactivo = diasInactivo;
    }

    @Transactional(readOnly = true)
    public EmpleadosDTO listar() {
        // Una sola consulta para TODOS: [usuarioId, totalReportes, fechaUltimoReporte]
        Map<Long, Object[]> stats = new HashMap<>();
        for (Object[] fila : reporteRepository.estadisticasPorUsuario()) {
            stats.put((Long) fila[0], fila);
        }

        Map<Long, Boolean> enLinea = ubicacionService.enLineaPorEmpleado();
        LocalDateTime ahora = LocalDateTime.now();
        List<EmpleadoDTO> empleados = usuarioRepository.findByRolOrderByNombreAsc("LECTURISTA").stream()
                .map(u -> {
                    Object[] s = stats.get(u.getId());
                    long total = s != null ? (Long) s[1] : 0L;
                    LocalDateTime ultimoReporte = s != null ? (LocalDateTime) s[2] : null;
                    return armar(u, total, ultimoReporte, ahora, diasInactivo, enLinea.getOrDefault(u.getId(), false));
                })
                .toList();
        return new EmpleadosDTO(diasInactivo, empleados);
    }

    /** Lógica pura (sin BD): fácil de probar con cualquier fecha. */
    static EmpleadoDTO armar(Usuario u, long totalReportes, LocalDateTime ultimoReporte,
                             LocalDateTime ahora, int diasInactivo, boolean enLinea) {
        LocalDateTime ultimaActividad = masReciente(u.getUltimoAcceso(), ultimoReporte);
        Long dias = ultimaActividad == null ? null : Math.max(0, Duration.between(ultimaActividad, ahora).toDays());
        boolean activo = ultimaActividad != null && ultimaActividad.isAfter(ahora.minusDays(diasInactivo));
        return new EmpleadoDTO(u.getId(), u.getNombre(), u.getUsername(), u.getUltimoAcceso(),
                ultimoReporte, totalReportes, ultimaActividad, activo, dias, enLinea);
    }

    private static LocalDateTime masReciente(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }
}

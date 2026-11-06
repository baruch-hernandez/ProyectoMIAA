package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.EmpleadoDTO;
import com.miaa.lecturas.dtos.EmpleadosDTO;
import com.miaa.lecturas.entities.Disponibilidad;
import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.ReporteRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
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
    private final UbicacionService ubicacionService;

    public EmpleadoService(UsuarioRepository usuarioRepository,
            ReporteRepository reporteRepository,
            UbicacionService ubicacionService,
            PresenciaService presenciaService) {
        this.usuarioRepository = usuarioRepository;
        this.reporteRepository = reporteRepository;
        this.ubicacionService = ubicacionService;
        this.presenciaService = presenciaService;
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
                    return armar(u, total, ultimoReporte, ahora, enLinea.getOrDefault(u.getId(), false),
                            presenciaService.estado(u));
                })
                // Los dados de baja al final (mismo orden por nombre dentro de cada grupo)
                .sorted(java.util.Comparator.comparing(e -> !e.habilitado()))
                .toList();
        return new EmpleadosDTO(empleados);
    }

    /**
     * Lógica pura (sin BD): fácil de probar con cualquier fecha.
     * 
     * @param disponibilidad
     */
    static EmpleadoDTO armar(Usuario u, long totalReportes, LocalDateTime ultimoReporte,
            LocalDateTime ahora, boolean enLinea,
            Disponibilidad disponibilidad) {
        LocalDateTime ultimaActividad = masReciente(u.getUltimoAcceso(), ultimoReporte);
        Long dias = ultimaActividad == null ? null : Math.max(0, Duration.between(ultimaActividad, ahora).toDays());
        // Un empleado dado de baja nunca cuenta como activo
        Disponibilidad estado = u.estaHabilitado() ? disponibilidad : Disponibilidad.DESCONECTADO;
        return new EmpleadoDTO(u.getId(), u.getNombre(), u.getUsername(), u.getUltimoAcceso(),
                ultimoReporte, totalReportes, ultimaActividad, estado == Disponibilidad.EN_LINEA, dias, enLinea,
                u.estaHabilitado(), estado, u.getUltimaConexion(), u.getRol());
    }

    private static LocalDateTime masReciente(LocalDateTime a, LocalDateTime b) {
        if (a == null)
            return b;
        if (b == null)
            return a;
        return a.isAfter(b) ? a : b;
    }
}

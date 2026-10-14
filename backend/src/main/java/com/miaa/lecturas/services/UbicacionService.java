package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.dtos.UbicacionRequestDTO;
import com.miaa.lecturas.entities.UbicacionEmpleado;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UbicacionEmpleadoRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Ubicación en vivo de los lecturistas.
 *
 * Cómo funciona ("casi tiempo real" sin WebSockets):
 *  1. El celular del lecturista manda su posición cada ~20 s (POST /ubicacion).
 *  2. El admin, mientras tiene abierto el mapa, pregunta cada 5 s (GET .../ubicacion).
 *  3. "En línea" = el servidor recibió algo en los últimos N segundos y no cerró sesión.
 *     Si el celular se queda sin red, deja de llegar → pasa solo a "sin conexión".
 */
@Service
public class UbicacionService {

    private final UbicacionEmpleadoRepository ubicacionRepository;
    private final UsuarioRepository usuarioRepository;
    private final int segundosEnLinea;

    public UbicacionService(UbicacionEmpleadoRepository ubicacionRepository,
                            UsuarioRepository usuarioRepository,
                            @Value("${miaa.ubicacion.segundos-en-linea:60}") int segundosEnLinea) {
        this.ubicacionRepository = ubicacionRepository;
        this.usuarioRepository = usuarioRepository;
        this.segundosEnLinea = segundosEnLinea;
    }

    /** LECTURISTA: guarda (sobrescribe) su última ubicación. */
    @Transactional
    public void actualizar(UsuarioPrincipal yo, UbicacionRequestDTO req) {
        Instant ahora = Instant.now();
        UbicacionEmpleado u = ubicacionRepository.findById(yo.id()).orElseGet(() -> {
            UbicacionEmpleado nueva = new UbicacionEmpleado();
            nueva.setUsuarioId(yo.id());
            return nueva;
        });
        u.setLatitud(req.latitud());
        u.setLongitud(req.longitud());
        u.setPrecisionMetros(req.precision());
        // Si el reloj del celular dice algo absurdo (futuro), usamos la hora del servidor
        Instant fecha = req.fecha();
        u.setFechaDispositivo(fecha == null || fecha.isAfter(ahora.plusSeconds(600)) ? ahora : fecha);
        u.setFechaRecibida(ahora);
        u.setCompartiendo(true);
        ubicacionRepository.save(u);
    }

    /** LECTURISTA: cerró sesión → deja de aparecer en línea (se conserva el último punto). */
    @Transactional
    public void dejarDeCompartir(UsuarioPrincipal yo) {
        // Sin save(): la entidad está administrada y JPA guarda el cambio solo (dirty checking).
        ubicacionRepository.findById(yo.id()).ifPresent(u -> u.setCompartiendo(false));
    }

    /** El admin dio de baja al empleado: que deje de verse "en línea" al instante. */
    @Transactional
    public void marcarDesconectado(Long empleadoId) {
        ubicacionRepository.findById(empleadoId).ifPresent(u -> u.setCompartiendo(false));
    }

    /** ADMIN: dónde está un empleado. */
    @Transactional(readOnly = true)
    public UbicacionEmpleadoDTO deEmpleado(Long empleadoId) {
        Usuario empleado = usuarioRepository.findById(empleadoId)
                .filter(u -> "LECTURISTA".equals(u.getRol()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ese empleado no existe"));
        UbicacionEmpleado u = ubicacionRepository.findById(empleadoId).orElse(null);
        return armar(empleado, u, Instant.now(), segundosEnLinea);
    }

    /** Para la tabla de empleados: ¿quién está en línea ahorita? (una sola consulta) */
    @Transactional(readOnly = true)
    public Map<Long, Boolean> enLineaPorEmpleado() {
        Instant ahora = Instant.now();
        return ubicacionRepository.findAll().stream()
                .collect(Collectors.toMap(UbicacionEmpleado::getUsuarioId, u -> estaEnLinea(u, ahora, segundosEnLinea)));
    }

    // ---------------------------------------------------------------- lógica pura (se prueba sin BD)

    static boolean estaEnLinea(UbicacionEmpleado u, Instant ahora, int segundosEnLinea) {
        return u != null && u.isCompartiendo()
                && !u.getFechaRecibida().isBefore(ahora.minusSeconds(segundosEnLinea));
    }

    static UbicacionEmpleadoDTO armar(Usuario e, UbicacionEmpleado u, Instant ahora, int segundosEnLinea) {
        if (u == null) {
            return new UbicacionEmpleadoDTO(e.getId(), e.getNombre(), e.getUsername(), false, false,
                    null, null, null, null, null, null, segundosEnLinea);
        }
        long segundos = Math.max(0, Duration.between(u.getFechaRecibida(), ahora).getSeconds());
        return new UbicacionEmpleadoDTO(e.getId(), e.getNombre(), e.getUsername(), true,
                estaEnLinea(u, ahora, segundosEnLinea), u.getLatitud(), u.getLongitud(), u.getPrecisionMetros(),
                u.getFechaDispositivo(), u.getFechaRecibida(), segundos, segundosEnLinea);
    }
}

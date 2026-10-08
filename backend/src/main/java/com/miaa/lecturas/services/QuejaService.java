package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.NotaDTO;
import com.miaa.lecturas.dtos.QuejaDetalleDTO;
import com.miaa.lecturas.dtos.QuejaRequestDTO;
import com.miaa.lecturas.dtos.QuejaResumenDTO;
import com.miaa.lecturas.entities.EstadoQueja;
import com.miaa.lecturas.entities.NotaQueja;
import com.miaa.lecturas.entities.Queja;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.NotaQuejaRepository;
import com.miaa.lecturas.repositories.QuejaRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Aquí viven las REGLAS DE NEGOCIO de las quejas.
 *
 *  - El controlador solo traduce HTTP ↔ Java.
 *  - El repositorio solo habla con la BD.
 *  - El servicio DECIDE: quién puede ver qué, qué datos son válidos, etc.
 *
 * Quién puede ver una queja:
 *  - quien la registró,
 *  - el trabajador al que se asignó,
 *  - cualquier ADMIN (jefe).
 */
@Service
public class QuejaService {

    /** Los 11 municipios del estado de Aguascalientes. */
    public static final List<String> MUNICIPIOS = List.of(
            "Aguascalientes", "Asientos", "Calvillo", "Cosío", "El Llano",
            "Jesús María", "Pabellón de Arteaga", "Rincón de Romos",
            "San Francisco de los Romo", "San José de Gracia", "Tepezalá");

    private static final Set<String> MUNICIPIOS_SET = Set.copyOf(MUNICIPIOS);

    // Una foto de ≤200 KB en base64 pesa ~270 K caracteres; damos margen.
    private static final int MAX_CARACTERES_FOTO = 400_000;

    private final QuejaRepository quejaRepository;
    private final NotaQuejaRepository notaRepository;
    private final UsuarioRepository usuarioRepository;
    private final LimiteAguascalientes limiteAgs;

    public QuejaService(QuejaRepository quejaRepository,
                        NotaQuejaRepository notaRepository,
                        UsuarioRepository usuarioRepository,
                        LimiteAguascalientes limiteAgs) {
        this.quejaRepository = quejaRepository;
        this.notaRepository = notaRepository;
        this.usuarioRepository = usuarioRepository;
        this.limiteAgs = limiteAgs;
    }

    // =====================================================================
    // Registrar
    // =====================================================================

    @Transactional
    public QuejaDetalleDTO crear(UsuarioPrincipal yo, QuejaRequestDTO req) {
        if (!MUNICIPIOS_SET.contains(req.municipio())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Municipio no válido: " + req.municipio());
        }
        validarUbicacion(req.latitud(), req.longitud());
        List<String> fotos = validarFotos(req.fotos());

        Usuario autor = usuarioRepository.findById(yo.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tu usuario ya no existe"));

        Queja q = new Queja();
        q.setCalle(req.calle().trim());
        q.setNumeroExterior(req.numeroExterior().trim());
        q.setNumeroInterior(textoOpcional(req.numeroInterior()));
        q.setColonia(req.colonia().trim());
        q.setCodigoPostal(req.codigoPostal());
        q.setMunicipio(req.municipio());
        q.setReferencias(textoOpcional(req.referencias()));
        q.setNumeroContrato(textoOpcional(req.numeroContrato()));
        q.setLatitud(req.latitud());
        q.setLongitud(req.longitud());
        q.setCategoria(req.categoria());
        q.setDescripcion(req.descripcion().trim());
        q.setPrioridad(req.prioridad());
        q.setEstado(EstadoQueja.PENDIENTE); // siempre nace pendiente, aunque el cliente mande otra cosa
        q.setCreadoPor(autor);
        q.getFotos().addAll(fotos);

        Queja guardada = quejaRepository.save(q);
        return aDetalle(guardada, List.of());
    }

    // =====================================================================
    // Consultar
    // =====================================================================

    /** Las quejas que registró el usuario que hace la petición (opcionalmente filtradas). */
    @Transactional(readOnly = true)
    public List<QuejaResumenDTO> misQuejas(UsuarioPrincipal yo, EstadoQueja estado) {
        List<Queja> quejas = (estado == null)
                ? quejaRepository.buscarDeUsuario(yo.id())
                : quejaRepository.buscarDeUsuarioPorEstado(yo.id(), estado);

        return quejas.stream().map(QuejaResumenDTO::desde).toList();
    }

    @Transactional(readOnly = true)
    public QuejaDetalleDTO detalle(UsuarioPrincipal yo, Long id) {
        Queja q = obtenerConAcceso(yo, id);
        List<NotaQueja> notas = notaRepository.buscarPorQueja(id);
        return aDetalle(q, notas);
    }

    // =====================================================================
    // Notas
    // =====================================================================

    @Transactional
    public NotaDTO agregarNota(UsuarioPrincipal yo, Long quejaId, String texto) {
        Queja q = obtenerConAcceso(yo, quejaId);

        Usuario autor = usuarioRepository.findById(yo.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tu usuario ya no existe"));

        NotaQueja nota = notaRepository.save(new NotaQueja(q, autor, texto.trim()));

        // Marcar la queja como "actualizada". No hace falta llamar save(q):
        // la entidad está "administrada" por JPA y al terminar la transacción
        // detecta el cambio y hace el UPDATE solo (dirty checking).
        q.setFechaActualizacion(LocalDateTime.now());

        return NotaDTO.desde(nota);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Queja obtenerConAcceso(UsuarioPrincipal yo, Long id) {
        Queja q = quejaRepository.buscarConUsuarios(id)
                .orElseThrow(() -> noEncontrada(id));

        boolean esCreador = Objects.equals(q.getCreadoPor().getId(), yo.id());
        boolean esAsignado = q.getAsignadoA() != null && Objects.equals(q.getAsignadoA().getId(), yo.id());

        if (!(yo.esAdmin() || esCreador || esAsignado)) {
            // Respondemos 404 (no 403) para no revelar que esa queja existe.
            throw noEncontrada(id);
        }
        return q;
    }

    private static ResponseStatusException noEncontrada(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "La queja #" + id + " no existe");
    }

    /**
     * La ubicación es opcional, pero si viene: completa (latitud Y longitud) y dentro
     * del estado. El @DecimalMin/@DecimalMax del DTO solo revisa un rectángulo; esto
     * revisa el contorno real (el rectángulo incluye pedazos de Zacatecas y Jalisco).
     */
    private void validarUbicacion(Double lat, Double lng) {
        if (lat == null && lng == null) return;
        if (lat == null || lng == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La ubicación debe traer latitud y longitud");
        }
        if (!limiteAgs.contiene(lat, lng)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La ubicación está fuera del estado de Aguascalientes");
        }
    }

    private static List<String> validarFotos(List<String> fotos) {
        if (fotos == null) {
            return List.of();
        }
        List<String> limpias = new ArrayList<>();
        for (String foto : fotos) {
            if (foto == null || foto.isBlank()) {
                continue;
            }
            if (!foto.startsWith("data:image/")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Una de las fotos no es una imagen válida");
            }
            if (foto.length() > MAX_CARACTERES_FOTO) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Una de las fotos pesa más de 200 KB");
            }
            limpias.add(foto);
        }
        return limpias;
    }

    private static String textoOpcional(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** Se llama DENTRO de la transacción: aquí todavía se pueden cargar las fotos (LAZY). */
    private static QuejaDetalleDTO aDetalle(Queja q, List<NotaQueja> notas) {
        return new QuejaDetalleDTO(
                q.getId(),
                q.getFolio(),
                q.getCalle(),
                q.getNumeroExterior(),
                q.getNumeroInterior(),
                q.getColonia(),
                q.getCodigoPostal(),
                q.getMunicipio(),
                q.getReferencias(),
                q.getNumeroContrato(),
                q.getLatitud(),
                q.getLongitud(),
                q.getCategoria(),
                q.getDescripcion(),
                q.getPrioridad(),
                q.getEstado(),
                q.getCreadoPor().getNombre(),
                q.getAsignadoA() != null ? q.getAsignadoA().getNombre() : null,
                q.getFechaCreacion(),
                q.getFechaActualizacion(),
                List.copyOf(q.getFotos()),
                notas.stream().map(NotaDTO::desde).toList());
    }
}

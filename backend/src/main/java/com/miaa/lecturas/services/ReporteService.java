package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.DatosReporte;
import com.miaa.lecturas.dtos.FotoDTO;
import com.miaa.lecturas.dtos.FotoRequestDTO;
import com.miaa.lecturas.dtos.NotaDTO;
import com.miaa.lecturas.dtos.ReporteDetalleDTO;
import com.miaa.lecturas.dtos.ReporteEdicionDTO;
import com.miaa.lecturas.dtos.ReporteRequestDTO;
import com.miaa.lecturas.dtos.ReporteResumenDTO;
import com.miaa.lecturas.entities.FotoReporte;
import com.miaa.lecturas.entities.NotaReporte;
import com.miaa.lecturas.entities.Reporte;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.FotoReporteRepository;
import com.miaa.lecturas.repositories.NotaReporteRepository;
import com.miaa.lecturas.repositories.ReporteRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * REGLAS DE NEGOCIO de los reportes.
 *
 *  - El controlador solo traduce HTTP ↔ Java.
 *  - El repositorio solo habla con la BD.
 *  - El servicio DECIDE: quién puede ver/cambiar qué y qué datos son válidos.
 *
 * Quién puede hacer qué:
 *  - NOTIFICADOR: sube reportes, ve SOLO los suyos y les agrega notas cuando quiera.
 *    Puede CORREGIR, BORRAR o quitar/poner FOTOS solo en las primeras N horas (configurable):
 *    después queda fijo como evidencia.
 *  - ADMIN: ve TODOS los reportes, pero solo para consultar (no los cambia).
 */
@Service
public class ReporteService {

    /** Los 11 municipios del estado de Aguascalientes. */
    public static final List<String> MUNICIPIOS = List.of(
            "Aguascalientes", "Asientos", "Calvillo", "Cosío", "El Llano",
            "Jesús María", "Pabellón de Arteaga", "Rincón de Romos",
            "San Francisco de los Romo", "San José de Gracia", "Tepezalá");

    private static final Set<String> MUNICIPIOS_SET = Set.copyOf(MUNICIPIOS);

    public static final int MAX_FOTOS = 3;

    private final ReporteRepository reporteRepository;
    private final FotoReporteRepository fotoRepository;
    private final NotaReporteRepository notaRepository;
    private final UsuarioRepository usuarioRepository;
    private final LimiteAguascalientes limiteAgs;
    private final ValidadorFotos validadorFotos;
    private final int horasParaModificar;

    public ReporteService(ReporteRepository reporteRepository,
                          FotoReporteRepository fotoRepository,
                          NotaReporteRepository notaRepository,
                          UsuarioRepository usuarioRepository,
                          LimiteAguascalientes limiteAgs,
                          ValidadorFotos validadorFotos,
                          @Value("${miaa.reportes.horas-para-modificar:24}") int horasParaModificar) {
        this.reporteRepository = reporteRepository;
        this.fotoRepository = fotoRepository;
        this.notaRepository = notaRepository;
        this.usuarioRepository = usuarioRepository;
        this.limiteAgs = limiteAgs;
        this.validadorFotos = validadorFotos;
        this.horasParaModificar = horasParaModificar;
    }

    // =====================================================================
    // Subir un reporte (NOTIFICADOR)
    // =====================================================================

    @Transactional
    public ReporteDetalleDTO crear(UsuarioPrincipal yo, ReporteRequestDTO req) {
        // ¿Ya lo habíamos recibido? Pasa si el celular lo guardó sin conexión, lo envió,
        // y la respuesta se perdió antes de llegarle: al reintentar, NO se duplica.
        if (req.clienteId() != null) {
            Optional<Reporte> previo = reporteRepository.buscarPorClienteId(req.clienteId());
            if (previo.isPresent()) {
                if (!esAutor(yo, previo.get())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese identificador de reporte ya se usó.");
                }
                return aDetalle(previo.get(), notaRepository.buscarPorReporte(previo.get().getId()), yo);
            }
        }
        validarDatos(req);
        List<FotoRequestDTO> fotos = req.fotos() == null ? List.of() : req.fotos();
        if (fotos.size() > MAX_FOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo " + MAX_FOTOS + " fotos por reporte");
        }

        Reporte r = new Reporte();
        aplicarDatos(r, req);
        r.setClienteId(req.clienteId());
        r.setCreadoPor(usuarioActual(yo));
        // Si UNA foto no pasa, se lanza la excepción y la transacción se deshace completa:
        // no queda un reporte a medias.
        fotos.forEach(f -> r.agregarFoto(crearFoto(f)));

        Reporte guardado = reporteRepository.save(r);
        return aDetalle(guardado, List.of(), yo);
    }

    // =====================================================================
    // Corregir o borrar (NOTIFICADOR, solo el suyo y a tiempo)
    // =====================================================================

    @Transactional
    public ReporteDetalleDTO editar(UsuarioPrincipal yo, Long id, ReporteEdicionDTO req) {
        Reporte r = obtenerParaModificar(yo, id);
        validarDatos(req);
        aplicarDatos(r, req);
        r.setFechaEdicion(LocalDateTime.now()); // el admin verá "Editado"
        return aDetalle(r, notaRepository.buscarPorReporte(id), yo);
    }

    @SuppressWarnings("null")
    @Transactional
    public void borrar(UsuarioPrincipal yo, Long id) {
        Reporte r = obtenerParaModificar(yo, id);
        // CascadeType.ALL en fotos y notas: se borran junto con el reporte
        reporteRepository.delete(r);
    }

    // =====================================================================
    // Consultar
    // =====================================================================

    /** NOTIFICADOR: solo los reportes que él subió, del más nuevo al más viejo. */
    @Transactional(readOnly = true)
    public List<ReporteResumenDTO> mios(UsuarioPrincipal yo) {
        return aResumenes(reporteRepository.buscarDeUsuario(yo.id()));
    }

    /** ADMIN: los reportes de todos los empleados. */
    @Transactional(readOnly = true)
    public List<ReporteResumenDTO> todos() {
        return aResumenes(reporteRepository.buscarTodos());
    }

    @Transactional(readOnly = true)
    public ReporteDetalleDTO detalle(UsuarioPrincipal yo, Long id) {
        Reporte r = obtenerParaVer(yo, id);
        return aDetalle(r, notaRepository.buscarPorReporte(id), yo);
    }

    // =====================================================================
    // Notas y fotos (solo quien subió el reporte)
    // =====================================================================

    @Transactional
    public NotaDTO agregarNota(UsuarioPrincipal yo, Long reporteId, String texto) {
        Reporte r = obtenerParaEditar(yo, reporteId);
        NotaReporte nota = notaRepository.save(new NotaReporte(r, usuarioActual(yo), texto.trim()));
        // Sin save(r): JPA detecta el cambio al cerrar la transacción (dirty checking).
        r.setFechaActualizacion(LocalDateTime.now());
        return NotaDTO.desde(nota);
    }

    // Las fotos son la evidencia: se cambian solo dentro de la ventana, igual que el domicilio,
    // y cuentan como edición (el admin ve "Editado").
    @Transactional
    public FotoDTO agregarFoto(UsuarioPrincipal yo, Long reporteId, FotoRequestDTO req) {
        Reporte r = obtenerParaModificar(yo, reporteId);
        reporteRepository.bloquear(reporteId); // la otra subida espera aquí hasta que esta termine
        if (fotoRepository.countByReporteId(reporteId) >= MAX_FOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El reporte ya tiene " + MAX_FOTOS + " fotos. Borra una para poner otra.");
        }
        FotoReporte foto = crearFoto(req);
        foto.setReporte(r);
        FotoReporte guardada = fotoRepository.save(foto);
        marcarEditado(r);
        return FotoDTO.desde(guardada);
    }

    @SuppressWarnings("null")
    @Transactional
    public void borrarFoto(UsuarioPrincipal yo, Long reporteId, Long fotoId) {
        Reporte r = obtenerParaModificar(yo, reporteId);
        @SuppressWarnings("null")
        FotoReporte foto = fotoRepository.findById(fotoId)
                // ¿La foto es de ESTE reporte? Si no, para nosotros "no existe".
                .filter(f -> Objects.equals(f.getReporte().getId(), reporteId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Esa foto ya no existe"));
        fotoRepository.delete(foto);
        marcarEditado(r);
    }

    private static void marcarEditado(Reporte r) {
        LocalDateTime ahora = LocalDateTime.now();
        r.setFechaActualizacion(ahora);
        r.setFechaEdicion(ahora);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /** Ver: quien lo subió o cualquier ADMIN. */
    private Reporte obtenerParaVer(UsuarioPrincipal yo, Long id) {
        Reporte r = reporteRepository.buscarConAutor(id).orElseThrow(() -> noEncontrado(id));
        if (!yo.esAdmin() && !esAutor(yo, r)) {
            throw noEncontrado(id); // 404 (no 403) para no revelar que existe
        }
        return r;
    }

    /** Cambiar (notas/fotos): SOLO quien lo subió. El ADMIN solo consulta. */
    private Reporte obtenerParaEditar(UsuarioPrincipal yo, Long id) {
        Reporte r = obtenerParaVer(yo, id);
        if (!esAutor(yo, r)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Solo el notificador que subió el reporte puede modificarlo.");
        }
        return r;
    }

    /** Corregir o borrar: además de ser el autor, debe estar dentro de la ventana de tiempo. */
    private Reporte obtenerParaModificar(UsuarioPrincipal yo, Long id) {
        Reporte r = obtenerParaEditar(yo, id);
        if (!dentroDeVentana(r.getFechaCreacion(), LocalDateTime.now(), horasParaModificar)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Ya pasaron las " + horasParaModificar + " h para corregir o borrar este reporte. "
                            + "Puedes agregarle una nota con la corrección.");
        }
        return r;
    }

    /** Lógica pura (se prueba sin BD): ¿todavía está a tiempo? */
    static boolean dentroDeVentana(LocalDateTime creado, LocalDateTime ahora, int horas) {
        return creado != null && ahora.isBefore(creado.plusHours(horas));
    }

    private static boolean esAutor(UsuarioPrincipal yo, Reporte r) {
        return Objects.equals(r.getCreadoPor().getId(), yo.id());
    }

    @SuppressWarnings("null")
    private Usuario usuarioActual(UsuarioPrincipal yo) {
        return usuarioRepository.findById(yo.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tu usuario ya no existe"));
    }

    private void validarDatos(DatosReporte d) {
        if (!MUNICIPIOS_SET.contains(d.municipio())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Municipio no válido: " + d.municipio());
        }
        validarUbicacion(d.latitud(), d.longitud());
    }

    /** Copia domicilio, ubicación y descripción (sirve igual para crear y para editar). */
    private static void aplicarDatos(Reporte r, DatosReporte d) {
        r.setCalle(d.calle().trim());
        r.setNumeroExterior(d.numeroExterior().trim());
        r.setNumeroInterior(textoOpcional(d.numeroInterior()));
        r.setColonia(d.colonia().trim());
        r.setCodigoPostal(d.codigoPostal());
        r.setMunicipio(d.municipio());
        r.setReferencias(textoOpcional(d.referencias()));
        r.setNumeroContrato(textoOpcional(d.numeroContrato()));
        r.setLatitud(d.latitud());
        r.setLongitud(d.longitud());
        r.setDescripcion(d.descripcion().trim());
    }

    private FotoReporte crearFoto(FotoRequestDTO req) {
        ValidadorFotos.Medidas medidas = validadorFotos.validar(req.datos()); // HD o error 400
        validadorFotos.validarFechaCaptura(req.fechaCaptura());

        FotoReporte f = new FotoReporte();
        f.setDatos(req.datos());
        f.setAncho(medidas.ancho());
        f.setAlto(medidas.alto());
        f.setFechaCaptura(req.fechaCaptura()); // la hora en que se TOMÓ (la que pidió MIAA)
        f.setOrigenFecha(req.origenFecha());
        return f; // fechaSubida la pone @PrePersist
    }

    private static ResponseStatusException noEncontrado(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "El reporte #" + id + " no existe");
    }

    /**
     * La ubicación es opcional, pero si viene: completa y dentro del estado.
     * El @DecimalMin/@DecimalMax del DTO solo revisa un rectángulo; esto revisa el contorno real.
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

    private static String textoOpcional(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** Lista → resúmenes, contando fotos y notas con 2 consultas en total (no 2 por reporte). */
    private List<ReporteResumenDTO> aResumenes(List<Reporte> reportes) {
        if (reportes.isEmpty()) {
            return List.of();
        }
        @SuppressWarnings("null")
        List<Long> ids = reportes.stream().map(Reporte::getId).toList();
        Map<Long, Long> fotos = aMapa(reporteRepository.contarFotos(ids));
        Map<Long, Long> notas = aMapa(reporteRepository.contarNotas(ids));
        return reportes.stream()
                .map(r -> ReporteResumenDTO.desde(r, fotos.getOrDefault(r.getId(), 0L), notas.getOrDefault(r.getId(), 0L)))
                .toList();
    }

    private static Map<Long, Long> aMapa(List<Object[]> filas) {
        Map<Long, Long> mapa = new HashMap<>();
        for (Object[] fila : filas) {
            mapa.put((Long) fila[0], (Long) fila[1]);
        }
        return mapa;
    }

    /** Se llama DENTRO de la transacción: aquí todavía se pueden cargar las fotos (LAZY). */
    private ReporteDetalleDTO aDetalle(Reporte r, List<NotaReporte> notas, UsuarioPrincipal yo) {
        return new ReporteDetalleDTO(
                r.getId(),
                r.getFolio(),
                r.getCalle(),
                r.getNumeroExterior(),
                r.getNumeroInterior(),
                r.getColonia(),
                r.getCodigoPostal(),
                r.getMunicipio(),
                r.getReferencias(),
                r.getNumeroContrato(),
                r.getLatitud(),
                r.getLongitud(),
                r.getDescripcion(),
                r.getCreadoPor().getNombre(),
                r.getFechaCreacion(),
                r.getFechaActualizacion(),
                r.getFechaEdicion(),
                r.getFotos().stream().map(FotoDTO::desde).toList(),
                notas.stream().map(NotaDTO::desde).toList(),
                esAutor(yo, r),
                esAutor(yo, r) && dentroDeVentana(r.getFechaCreacion(), LocalDateTime.now(), horasParaModificar),
                esAutor(yo, r) && r.getFechaCreacion() != null ? r.getFechaCreacion().plusHours(horasParaModificar) : null);
    }
}

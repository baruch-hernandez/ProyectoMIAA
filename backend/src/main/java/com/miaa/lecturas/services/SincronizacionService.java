package com.miaa.lecturas.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.ReporteDetalleDTO;
import com.miaa.lecturas.dtos.ReporteRequestDTO;
import com.miaa.lecturas.dtos.ResultadoSyncDTO;
import com.miaa.lecturas.dtos.ResultadoSyncDTO.Rechazado;
import com.miaa.lecturas.dtos.ResultadoSyncDTO.Sincronizado;
import com.miaa.lecturas.entities.Reporte;
import com.miaa.lecturas.repositories.ReporteRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Sprint 4 (tareas 1.1, 1.3 y 1.4): recibe de golpe los reportes que el celular guardó sin conexión.
 *
 * Cada reporte del lote se guarda en SU PROPIA transacción (ReporteService.crear): si uno no pasa,
 * los demás sí se guardan, y la respuesta dice cuál falló y por qué.
 *
 * No duplica: el reporte trae el UUID que generó el celular (clientSyncId). Si ya se había recibido
 * (la respuesta se perdió y el celular reintenta), se responde como sincronizado con el id de antes.
 *
 * Además de las reglas de siempre (ReporteRequestDTO), aquí son obligatorias las coordenadas, al
 * menos una foto y la hora de captura en UTC: es lo mínimo para confiar en un reporte hecho sin red.
 */
@Service
public class SincronizacionService {

    /** La app manda de 5 en 5; más que esto por petición es un cliente mal hecho. */
    public static final int MAX_LOTE = 20;

    private static final Pattern UUID = Pattern.compile("[0-9a-fA-F-]{36}");
    /** ISO-8601 en UTC, con la Z: "2026-11-11T16:05:00Z" o con milisegundos "…:00.123Z". */
    private static final Pattern UTC = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,9})?Z");

    private final ReporteService reporteService;
    private final ReporteRepository reporteRepository;
    private final ObjectMapper mapper;
    private final Validator validator;

    public SincronizacionService(ReporteService reporteService, ReporteRepository reporteRepository,
                                 ObjectMapper mapper, Validator validator) {
        this.reporteService = reporteService;
        this.reporteRepository = reporteRepository;
        this.mapper = mapper;
        this.validator = validator;
    }

    /**
     * @param reportesJson la parte "reportes": lista de reportes; cada foto dice en "parte" cómo se
     *                     llama el archivo que la trae
     * @param archivos     las fotos (binarias), por nombre de parte
     */
    public ResultadoSyncDTO sincronizar(UsuarioPrincipal yo, String reportesJson, Map<String, MultipartFile> archivos) {
        JsonNode lista;
        try {
            lista = mapper.readTree(reportesJson);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La parte 'reportes' no es un JSON válido");
        }
        if (lista == null || !lista.isArray()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La parte 'reportes' debe ser una lista");
        }
        if (lista.size() > MAX_LOTE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo " + MAX_LOTE + " reportes por envío");
        }

        List<Sincronizado> sincronizados = new ArrayList<>();
        List<Rechazado> rechazados = new ArrayList<>();
        for (JsonNode nodo : lista) {
            String id = nodo.path("clientSyncId").asText(null);
            try {
                ReporteDetalleDTO r = guardar(yo, nodo, id, archivos);
                sincronizados.add(new Sincronizado(id, r.id(), r.folio()));
            } catch (Rechazo e) {
                rechazados.add(new Rechazado(id, e.getMessage(), e.errores));
            } catch (ResponseStatusException e) {
                rechazados.add(new Rechazado(id, e.getReason(), null));
            } catch (DataIntegrityViolationException e) {
                // Dos reintentos del mismo reporte llegaron a la vez: el otro ya lo guardó
                Optional<Reporte> previo = reporteRepository.buscarPorClienteId(id);
                if (previo.isPresent() && Objects.equals(previo.get().getCreadoPor().getId(), yo.id())) {
                    sincronizados.add(new Sincronizado(id, previo.get().getId(), previo.get().getFolio()));
                } else {
                    rechazados.add(new Rechazado(id, "Ese identificador de reporte ya se usó.", null));
                }
            }
        }
        return new ResultadoSyncDTO(sincronizados, rechazados);
    }

    private ReporteDetalleDTO guardar(UsuarioPrincipal yo, JsonNode nodo, String id, Map<String, MultipartFile> archivos) {
        Map<String, String> errores = new LinkedHashMap<>();
        if (id == null || !UUID.matcher(id).matches()) {
            errores.put("clientSyncId", "Falta el UUID del reporte");
        }
        if (!UTC.matcher(nodo.path("fechaCaptura").asText("")).matches()) {
            errores.put("fechaCaptura", "Falta la hora de captura en UTC (p. ej. 2026-11-11T16:05:00Z)");
        }
        if (!nodo.path("latitud").isNumber() || !nodo.path("longitud").isNumber()) {
            errores.put("latitud", "Faltan las coordenadas del domicilio");
        }
        JsonNode fotos = nodo.path("fotos");
        if (!fotos.isArray() || fotos.isEmpty()) {
            errores.put("fotos", "Falta la foto del domicilio");
        }
        if (!errores.isEmpty()) {
            throw new Rechazo(errores);
        }

        // Cada foto pasa a "datos" (data URL) para validarla y guardarla igual que las de POST /reportes
        ObjectNode copia = nodo.deepCopy();
        copia.put("clienteId", id);
        for (JsonNode foto : copia.path("fotos")) {
            String parte = foto.path("parte").asText("");
            MultipartFile archivo = archivos.get(parte);
            if (archivo == null || archivo.isEmpty()) {
                throw new Rechazo(Map.of("fotos", "No llegó el archivo de la foto \"" + parte + "\""));
            }
            ((ObjectNode) foto).put("datos", aDataUrl(archivo));
        }

        ReporteRequestDTO req;
        try {
            req = mapper.treeToValue(copia, ReporteRequestDTO.class);
        } catch (JsonProcessingException e) {
            throw new Rechazo(Map.of(campo(e), "Formato no válido"));
        }
        Map<String, String> invalidos = new LinkedHashMap<>();
        for (ConstraintViolation<ReporteRequestDTO> v : validator.validate(req)) {
            invalidos.putIfAbsent(v.getPropertyPath().toString(), v.getMessage());
        }
        if (!invalidos.isEmpty()) {
            throw new Rechazo(invalidos);
        }
        return reporteService.crear(yo, req); // ya recibido → el de antes; si no, valida municipio, contorno y fotos
    }

    private static String aDataUrl(MultipartFile archivo) {
        String tipo = "image/png".equalsIgnoreCase(archivo.getContentType()) ? "png" : "jpeg";
        try {
            return "data:image/" + tipo + ";base64," + Base64.getEncoder().encodeToString(archivo.getBytes());
        } catch (IOException e) {
            throw new Rechazo(Map.of("fotos", "No se pudo leer una foto"));
        }
    }

    private static String campo(JsonProcessingException e) {
        if (e instanceof JsonMappingException m && !m.getPath().isEmpty()) {
            String nombre = m.getPath().get(m.getPath().size() - 1).getFieldName();
            if (nombre != null) return nombre;
        }
        return "reporte";
    }

    /** Un reporte del lote no pasó la validación: va a "rechazados" con un mensaje por campo. */
    private static final class Rechazo extends RuntimeException {
        final Map<String, String> errores;

        Rechazo(Map<String, String> errores) {
            super("Revisa los datos del reporte", null, false, false);
            this.errores = errores;
        }
    }
}

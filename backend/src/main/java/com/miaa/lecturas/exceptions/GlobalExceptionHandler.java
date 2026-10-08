package com.miaa.lecturas.exceptions;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Convierte las excepciones en respuestas JSON con UN solo formato:
 *
 *   { "status": 400, "message": "Revisa los datos", "errores": { "calle": "La calle es obligatoria" } }
 *
 * Se usa "message" porque el front ya lee err.response.data.message.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ApiError(int status, String message, Map<String, String> errores, LocalDateTime fecha) {
        static ApiError de(int status, String message) {
            return new ApiError(status, message, null, LocalDateTime.now());
        }
    }

    /** @Valid falló: un mensaje por campo para pintarlo debajo de cada input. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validacion(MethodArgumentNotValidException ex) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> errores.putIfAbsent(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.badRequest()
                .body(new ApiError(400, "Revisa los datos del formulario", errores, LocalDateTime.now()));
    }

    /** JSON mal formado o un valor de enum que no existe, p. ej. "categoria": "INUNDACION". */
    @ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class })
    public ResponseEntity<ApiError> formatoInvalido(Exception ex) {
        return ResponseEntity.badRequest().body(ApiError.de(400, "Formato de datos inválido"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> conStatus(ResponseStatusException ex) {
        int status = ex.getStatusCode().value();
        String mensaje = ex.getReason() != null ? ex.getReason() : "Error " + status;
        return ResponseEntity.status(status).body(ApiError.de(status, mensaje));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> prohibido(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiError.de(403, "No tienes permiso para esta acción"));
    }

    /**
     * Último recurso. Si es un error "conocido" de Spring MVC (404 de ruta,
     * 405 de método, 415 de content-type...) respeta su status; si no, 500.
     * El detalle técnico va al log del servidor, nunca al cliente.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> inesperado(Exception ex) {
        if (ex instanceof ErrorResponse er) {
            int status = er.getStatusCode().value();
            return ResponseEntity.status(status).body(ApiError.de(status, "Error " + status));
        }
        log.error("Error no controlado", ex);
        return ResponseEntity.internalServerError()
                .body(ApiError.de(500, "Ocurrió un error inesperado en el servidor"));
    }
}

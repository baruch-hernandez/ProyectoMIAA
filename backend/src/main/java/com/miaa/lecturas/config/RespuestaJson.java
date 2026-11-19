package com.miaa.lecturas.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;

import java.io.IOException;



public final class RespuestaJson {

    private RespuestaJson() {
    }

    public static void error(HttpServletResponse res, int status, String mensaje, String codigo) throws IOException {
        error(res, status, mensaje, codigo, null);
    }

    public static void error(HttpServletResponse res, int status, String mensaje, String codigo, Long segundos)
            throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        String extra = (codigo == null ? "" : ",\"codigo\":\"" + codigo + "\"")
                + (segundos == null ? "" : ",\"segundos\":" + segundos);
        // Los mensajes son nuestros (sin comillas), por eso basta con concatenar
        res.getWriter().write("{\"status\":" + status + ",\"message\":\"" + mensaje + "\"" + extra + "}");
    }
}

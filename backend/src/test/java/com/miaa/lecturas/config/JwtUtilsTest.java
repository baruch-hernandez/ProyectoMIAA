package com.miaa.lecturas.config;

import com.miaa.lecturas.entities.Usuario;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Tarea 1.4: JWT firmado con HS256 y con vida de 24 horas. */
class JwtUtilsTest {

    private static final String SECRETO = "404F635266556A586E3272357538782F413F4428472B4B6250645367566B5970";
    private static final long VEINTICUATRO_HORAS_MS = 86_400_000L;

    private final JwtUtils jwt = new JwtUtils(SECRETO, VEINTICUATRO_HORAS_MS);

    private static Usuario usuario() {
        Usuario u = new Usuario();
        u.setId(7L);
        u.setUsername("notificador1");
        u.setNombre("Juan Pérez");
        u.setRol("NOTIFICADOR");
        return u;
    }

    /** Lee un número del payload del JWT (la parte del medio, en Base64URL). */
    private static long campo(String token, String nombre) {
        String payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);
        Matcher m = Pattern.compile("\"" + nombre + "\":(\\d+)").matcher(payload);
        if (!m.find()) {
            throw new AssertionError("El token no trae \"" + nombre + "\": " + payload);
        }
        return Long.parseLong(m.group(1));
    }

    @Test
    void elTokenTraeQuienEsYSuRol() {
        UsuarioPrincipal yo = jwt.validarToken(jwt.generarToken(usuario()));
        assertEquals(7L, yo.id());
        assertEquals("notificador1", yo.username());
        assertEquals("NOTIFICADOR", yo.rol());
    }

    @Test
    void elTokenDuraVeinticuatroHoras() {
        String token = jwt.generarToken(usuario());
        assertEquals(86_400, campo(token, "exp") - campo(token, "iat"));
    }

    @Test
    void unTokenAlteradoSeRechaza() {
        String token = jwt.generarToken(usuario());
        String[] partes = token.split("\\.");
        // Alguien se cambia el rol a ADMIN en el payload sin conocer la llave
        String payloadFalso = Base64.getUrlEncoder().withoutPadding().encodeToString(
                new String(Base64.getUrlDecoder().decode(partes[1]), StandardCharsets.UTF_8)
                        .replace("NOTIFICADOR", "ADMIN").getBytes(StandardCharsets.UTF_8));
        String falso = partes[0] + "." + payloadFalso + "." + partes[2];
        assertThrows(JwtException.class, () -> jwt.validarToken(falso));
    }

    @Test
    void unTokenVencidoSeRechaza() {
        JwtUtils yaVencido = new JwtUtils(SECRETO, -1_000);
        String token = yaVencido.generarToken(usuario());
        assertThrows(JwtException.class, () -> jwt.validarToken(token));
    }

    @Test
    void unTokenFirmadoConOtraLlaveSeRechaza() {
        JwtUtils otro = new JwtUtils("otra-llave-secreta-de-al-menos-32-bytes-123456", VEINTICUATRO_HORAS_MS);
        assertThrows(JwtException.class, () -> jwt.validarToken(otro.generarToken(usuario())));
    }
}

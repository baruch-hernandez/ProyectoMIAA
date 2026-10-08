package com.miaa.lecturas.config;

import com.miaa.lecturas.entities.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

/**
 * Crea y valida los tokens JWT (API de jjwt 0.11.5, la versión del pom.xml).
 *
 * Un JWT tiene 3 partes: header.payload.firma
 * - El payload (id, nombre, rol) NO va cifrado, solo firmado: cualquiera puede
 *   leerlo, pero nadie puede cambiarlo sin la llave secreta.
 * - Por eso NUNCA metas contraseñas ni datos sensibles en el token.
 */
@Component
public class JwtUtils {

    private final Key llave;
    private final long expiracionMs;

    public JwtUtils(@Value("${jwt.secret}") String secreto,
                    @Value("${jwt.expiration}") long expiracionMs) {
        // HS256 necesita una llave de al menos 32 bytes (256 bits).
        this.llave = Keys.hmacShaKeyFor(secreto.getBytes(StandardCharsets.UTF_8));
        this.expiracionMs = expiracionMs;
    }

    /** Genera el token que se le entrega al front después del login. */
    public String generarToken(Usuario usuario) {
        Date ahora = new Date();
        return Jwts.builder()
                .setSubject(usuario.getUsername())
                .claim("id", usuario.getId())
                .claim("nombre", usuario.getNombre())
                .claim("rol", usuario.getRol())
                .setIssuedAt(ahora)
                .setExpiration(new Date(ahora.getTime() + expiracionMs))
                .signWith(llave, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Valida firma y expiración y regresa los datos del usuario.
     * Lanza JwtException si el token fue alterado, venció o está mal formado.
     */
    public UsuarioPrincipal validarToken(String token) throws JwtException {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(llave)
                .build()
                .parseClaimsJws(token)
                .getBody();

        // El JSON del token puede traer el número como Integer o Long: lo normalizamos.
        Number id = claims.get("id", Number.class);
        if (id == null) {
            throw new JwtException("El token no trae el id del usuario");
        }

        return new UsuarioPrincipal(
                id.longValue(),
                claims.getSubject(),
                claims.get("nombre", String.class),
                claims.get("rol", String.class));
    }
}

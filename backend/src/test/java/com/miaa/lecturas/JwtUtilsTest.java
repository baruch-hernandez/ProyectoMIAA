package com.miaa.lecturas;

import com.miaa.lecturas.config.JwtUtils;
import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.Usuario;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilsTest {

  private JwtUtils jwtUtils;
  // Clave secreta fija de prueba con longitud suficiente para HMAC-SHA256 (mínimo 32 bytes)
  private final String secretoPrueba = "claveSecretaDePruebaParaUnitTestsMIAA2026ConMasDe32Bytes!";
  private final long expiracion24hMs = 86400000L; // 24 horas

  @BeforeEach
  void setUp() {
    jwtUtils = new JwtUtils(secretoPrueba, expiracion24hMs);
  }

  @Test
  @DisplayName("1. Debe generar un token válido y extraer claims (id, username, rol)")
  void testGenerarYValidarToken() {
    Usuario usuario = new Usuario();
    usuario.setId(10L);
    usuario.setUsername("notificador_test");
    usuario.setNombre("Empleado Campo");
    usuario.setRol(Rol.NOTIFICADOR);

    String token = jwtUtils.generarToken(usuario);

    assertNotNull(token);
    assertFalse(token.isBlank());

    UsuarioPrincipal principal = jwtUtils.validarToken(token);

    assertEquals(10L, principal.id());
    assertEquals("notificador_test", principal.username());
    assertEquals("Empleado Campo", principal.nombre());
    assertEquals(Rol.NOTIFICADOR, principal.rol());
  }

  @Test
  @DisplayName("2. Debe rechazar el token si ya transcurrió su tiempo de vida (expirado)")
  void testTokenExpirado() {
    // Instancia con TTL negativo para simular un token expirado en el pasado
    JwtUtils jwtExpirado = new JwtUtils(secretoPrueba, -5000L);

    Usuario usuario = new Usuario();
    usuario.setId(1L);
    usuario.setUsername("admin");
    usuario.setNombre("Administrador");
    usuario.setRol(Rol.ADMIN);

    String tokenCaducado = jwtExpirado.generarToken(usuario);

    assertNotNull(tokenCaducado);
    assertThrows(JwtException.class, () -> jwtUtils.validarToken(tokenCaducado));
  }

  @Test
  @DisplayName("3. Debe rechazar un token alterado o con firma inválida")
  void testTokenManipulado() {
    Usuario usuario = new Usuario();
    usuario.setId(2L);
    usuario.setUsername("admin");
    usuario.setNombre("Administrador");
    usuario.setRol(Rol.ADMIN);

    String tokenOriginal = jwtUtils.generarToken(usuario);
    // Alteramos la firma modificando los últimos caracteres
    String tokenAlterado = tokenOriginal.substring(0, tokenOriginal.length() - 5) + "abcde";

    assertThrows(JwtException.class, () -> jwtUtils.validarToken(tokenAlterado));
  }
}
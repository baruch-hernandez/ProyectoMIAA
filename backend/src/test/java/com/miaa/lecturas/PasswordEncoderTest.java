package com.miaa.lecturas;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

class PasswordEncoderTest {

  private PasswordEncoder passwordEncoder;

  @BeforeEach
  void setUp() {
    passwordEncoder = new BCryptPasswordEncoder();
  }

  @Test
  @DisplayName("Debe generar hashes distintos con salt aleatorio para la misma contraseña")
  void testHashingConSaltAleatorio() {
    String passwordPlana = "PasswordSegura123#";

    String hash1 = passwordEncoder.encode(passwordPlana);
    String hash2 = passwordEncoder.encode(passwordPlana);

    assertNotNull(hash1);
    assertNotNull(hash2);
    // BCrypt siempre genera salts diferentes, los hashes no deben ser idénticos
    assertNotEquals(hash1, hash2);
    // Ambos deben tener 60 caracteres y empezar con el identificador $2a$ o $2b$
    assertTrue(hash1.startsWith("$2a$") || hash1.startsWith("$2b$"));
    assertEquals(60, hash1.length());
  }

  @Test
  @DisplayName("Debe validar coincidencias correctas y rechazar credenciales erróneas")
  void testValidacionPassword() {
    String passwordReal = "notificador1";
    String hash = passwordEncoder.encode(passwordReal);

    // Coincidencia correcta
    assertTrue(passwordEncoder.matches("notificador1", hash));

    // Password incorrecta
    assertFalse(passwordEncoder.matches("passwordErronea", hash));
  }
}
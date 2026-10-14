package com.miaa.lecturas.services;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Reglas mínimas para una contraseña. Las mismas se muestran en el front.
 *  - De 6 a 72 caracteres (BCrypt solo usa los primeros 72 bytes).
 *  - Al menos una letra y un número.
 */
public final class PoliticaPassword {

    public static final int MINIMO = 6;
    public static final int MAXIMO = 72;

    private PoliticaPassword() {
    }

    /** Regresa el problema, o null si la contraseña cumple. */
    public static String problema(String password) {
        if (password == null || password.length() < MINIMO) {
            return "La contraseña debe tener al menos " + MINIMO + " caracteres.";
        }
        if (password.length() > MAXIMO) {
            return "La contraseña no puede pasar de " + MAXIMO + " caracteres.";
        }
        if (password.chars().noneMatch(Character::isLetter) || password.chars().noneMatch(Character::isDigit)) {
            return "La contraseña debe tener al menos una letra y un número.";
        }
        return null;
    }

    public static void validar(String password) {
        String problema = problema(password);
        if (problema != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, problema);
        }
    }
}

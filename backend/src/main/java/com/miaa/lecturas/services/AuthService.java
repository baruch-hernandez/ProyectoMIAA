package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.AuthResponseDTO;
import com.miaa.lecturas.dtos.LoginRequestDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public AuthResponseDTO login(LoginRequestDTO request) {
        String identificador = request.getUsername();
        String passwordIngresado = request.getPassword();

        // 1. Buscar usuario por username o email
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(identificador);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByEmail(identificador);
        }

        if (usuarioOpt.isEmpty()) {
            throw new RuntimeException("El usuario '" + identificador + "' no existe en la base de datos.");
        }

        Usuario usuario = usuarioOpt.get();

        // 2. Validar contraseña (BCrypt o texto plano)
        boolean passwordValida = usuario.getPassword() != null
                && (passwordEncoder.matches(passwordIngresado, usuario.getPassword()) ||
                        passwordIngresado.equals(usuario.getPassword()));

        if (!passwordValida) {
            throw new RuntimeException("La contraseña ingresada no coincide.");
        }

        // 3. Crear DTO de respuesta
        String token = "token-miaa-session-" + usuario.getId();
        return new AuthResponseDTO(token, usuario.getId(), usuario.getNombre(), usuario.getRol());
    }
}
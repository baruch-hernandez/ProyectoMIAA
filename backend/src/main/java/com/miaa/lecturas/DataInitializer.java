package com.miaa.lecturas;

import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Override
    public void run(String... args) throws Exception {
        // Forzar la creación/actualización del Administrador
        Optional<Usuario> adminOpt = usuarioRepository.findByUsername("admin");
        Usuario admin = adminOpt.orElseGet(Usuario::new);
        admin.setNombre("Administrador MIAA");
        admin.setUsername("admin");
        admin.setEmail("admin@miaa.gob.mx");
        admin.setPassword("admin123");
        admin.setRol("ADMIN");
        usuarioRepository.save(admin);

        // Forzar la creación/actualización del Lecturista
        Optional<Usuario> lecturistaOpt = usuarioRepository.findByUsername("lecturista1");
        Usuario lecturista = lecturistaOpt.orElseGet(Usuario::new);
        lecturista.setNombre("Juan Pérez");
        lecturista.setUsername("lecturista1");
        lecturista.setEmail("juan.perez@miaa.gob.mx");
        lecturista.setPassword("123456");
        lecturista.setRol("LECTURISTA");
        usuarioRepository.save(lecturista);

        System.out.println("✅ Usuarios y contraseñas sincronizados en PostgreSQL:");
        System.out.println("   - Admin: admin / admin123");
        System.out.println("   - Lecturista: lecturista1 / 123456");
    }
}
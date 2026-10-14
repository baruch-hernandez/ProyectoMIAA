package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByUsername(String username);

    Optional<Usuario> findByEmail(String email);

    // SELECT * FROM usuarios WHERE rol = ? ORDER BY nombre
    List<Usuario> findByRolOrderByNombreAsc(String rol);

    // Para no repetir usuario ni correo (sin importar mayúsculas)
    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCaseAndIdNot(String username, Long id);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
}
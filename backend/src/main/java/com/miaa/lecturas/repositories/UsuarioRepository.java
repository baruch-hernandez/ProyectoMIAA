package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByUsername(String username);

    // Login: sin importar mayúsculas (igual que al dar de alta) y con SELECT ... FOR UPDATE,
    // para que dos intentos al mismo tiempo no pierdan la cuenta de contraseñas incorrectas.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Usuario> findParaLoginByUsernameIgnoreCase(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Usuario> findParaLoginByEmailIgnoreCase(String email);

    // SELECT * FROM usuarios WHERE rol = ? ORDER BY nombre
    List<Usuario> findByRolOrderByNombreAsc(String rol);

    // Para no repetir usuario ni correo (sin importar mayúsculas)
    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCaseAndIdNot(String username, Long id);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
}
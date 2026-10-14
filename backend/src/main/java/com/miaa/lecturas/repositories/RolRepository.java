package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Rol;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RolRepository extends JpaRepository<Rol, String> {
}

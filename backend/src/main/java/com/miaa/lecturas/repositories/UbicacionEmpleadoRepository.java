package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.UbicacionEmpleado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UbicacionEmpleadoRepository extends JpaRepository<UbicacionEmpleado, Long> {
}

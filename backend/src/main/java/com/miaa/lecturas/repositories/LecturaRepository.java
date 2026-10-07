package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Lectura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LecturaRepository extends JpaRepository<Lectura, Long> {
    List<Lectura> findByRutaId(Long rutaId);
}
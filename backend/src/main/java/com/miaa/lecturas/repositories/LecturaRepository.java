package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Lectura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LecturaRepository extends JpaRepository<Lectura, Long> {
    List<Lectura> findByRutaId(Long rutaId);

    // SELECT COUNT(*) FROM lecturas WHERE ruta_id = ?  (Spring lo arma por el nombre)
    long countByRutaId(Long rutaId);
}
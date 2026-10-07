package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Informe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InformeRepository extends JpaRepository<Informe, Long> {
    List<Informe> findByUsuarioId(Long usuarioId);
}
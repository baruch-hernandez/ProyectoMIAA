package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.NotaReporte;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotaReporteRepository extends JpaRepository<NotaReporte, Long> {

    @Query("""
            SELECT n FROM NotaReporte n
              JOIN FETCH n.autor
            WHERE n.reporte.id = :reporteId
            ORDER BY n.fechaCreacion ASC, n.id ASC
            """)
    List<NotaReporte> buscarPorReporte(@Param("reporteId") Long reporteId);
}

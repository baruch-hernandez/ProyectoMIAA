package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.FotoReporte;
import org.springframework.data.jpa.repository.JpaRepository;


import java.util.List;
public interface FotoReporteRepository extends JpaRepository<FotoReporte, Long> {

    // SELECT * FROM fotos_reporte WHERE reporte_id = ? ORDER BY fecha_captura, id
    List<FotoReporte> findByReporteIdOrderByFechaCapturaAscIdAsc(Long reporteId);

    long countByReporteId(Long reporteId);
}

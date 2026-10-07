package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Ruta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RutaRepository extends JpaRepository<Ruta, Long> {

    // Método para obtener las rutas asignadas a un lecturista específico por su ID
    List<Ruta> findByLecturistaId(Long lecturistaId);

    // Método opcional para filtrar por estado si lo necesitas en el futuro
    List<Ruta> findByLecturistaIdAndEstado(Long lecturistaId, String estado);
}
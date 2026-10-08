package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.EstadoQueja;
import com.miaa.lecturas.entities.Queja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuejaRepository extends JpaRepository<Queja, Long> {

  // JOIN FETCH trae al creador y al asignado en el MISMO SELECT.
  // Sin esto, por cada queja de la lista se haría otra consulta (problema "N+1").

  @Query("""
      SELECT q FROM Queja q
        JOIN FETCH q.creadoPor
        LEFT JOIN FETCH q.asignadoA
      WHERE q.creadoPor.id = :usuarioId
      ORDER BY q.fechaCreacion DESC
      """)
  List<Queja> buscarDeUsuario(@Param("usuarioId") Long usuarioId);

  // Consulta aparte para el filtro (en vez de "(:estado IS NULL OR ...)"),
  // que en PostgreSQL a veces falla con parámetros nulos.
  @Query("""
      SELECT q FROM Queja q
        JOIN FETCH q.creadoPor
        LEFT JOIN FETCH q.asignadoA
      WHERE q.creadoPor.id = :usuarioId AND q.estado = :estado
      ORDER BY q.fechaCreacion DESC
      """)
  List<Queja> buscarDeUsuarioPorEstado(@Param("usuarioId") Long usuarioId,
      @Param("estado") EstadoQueja estado);

  @Query("""
      SELECT q FROM Queja q
        JOIN FETCH q.creadoPor
        LEFT JOIN FETCH q.asignadoA
      WHERE q.id = :id
      """)
  Optional<Queja> buscarConUsuarios(@Param("id") Long id);
}

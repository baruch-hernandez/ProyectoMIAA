package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Reporte;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReporteRepository extends JpaRepository<Reporte, Long> {

    // JOIN FETCH trae al autor en el MISMO SELECT (sin esto: una consulta extra por
    // cada reporte de la lista, el famoso problema "N+1").
    // Las fotos NO se cargan aquí: pesan mucho y la lista solo necesita contarlas.

    @Query("""
            SELECT r FROM Reporte r
              JOIN FETCH r.creadoPor
            WHERE r.creadoPor.id = :usuarioId
            ORDER BY r.fechaCreacion DESC
            """)
    List<Reporte> buscarDeUsuario(@Param("usuarioId") Long usuarioId);

    @Query("""
            SELECT r FROM Reporte r
              JOIN FETCH r.creadoPor
            ORDER BY r.fechaCreacion DESC
            """)
    List<Reporte> buscarTodos();

    @Query("""
            SELECT r FROM Reporte r
              JOIN FETCH r.creadoPor
            WHERE r.id = :id
            """)
    Optional<Reporte> buscarConAutor(@Param("id") Long id);

    /** SELECT ... FOR UPDATE: dos fotos subidas al mismo tiempo se forman y no pasan del máximo. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Reporte r WHERE r.id = :id")
    Optional<Reporte> bloquear(@Param("id") Long id);

    /** Para reconocer un reporte reenviado (guardado sin conexión) y no duplicarlo. */
    @Query("""
            SELECT r FROM Reporte r
              JOIN FETCH r.creadoPor
            WHERE r.clienteId = :clienteId
            """)
    Optional<Reporte> buscarPorClienteId(@Param("clienteId") String clienteId);

    // [reporteId, número de fotos/notas] para las listas, sin traer las imágenes.
    // Se filtra por autor y NO con "IN (:ids)": PostgreSQL acepta máx. ~32 mil parámetros por
    // consulta, y con todos los ids la lista del admin tronaba al pasar de ese número de reportes.

    @Query("SELECT f.reporte.id, COUNT(f) FROM FotoReporte f GROUP BY f.reporte.id")
    List<Object[]> contarFotosDeTodos();

    @Query("SELECT n.reporte.id, COUNT(n) FROM NotaReporte n GROUP BY n.reporte.id")
    List<Object[]> contarNotasDeTodos();

    @Query("SELECT f.reporte.id, COUNT(f) FROM FotoReporte f WHERE f.reporte.creadoPor.id = :usuarioId GROUP BY f.reporte.id")
    List<Object[]> contarFotosDeUsuario(@Param("usuarioId") Long usuarioId);

    @Query("SELECT n.reporte.id, COUNT(n) FROM NotaReporte n WHERE n.reporte.creadoPor.id = :usuarioId GROUP BY n.reporte.id")
    List<Object[]> contarNotasDeUsuario(@Param("usuarioId") Long usuarioId);

    /** [usuarioId, cuántos reportes, fecha del último] — para saber si un empleado está activo. */
    @Query("SELECT r.creadoPor.id, COUNT(r), MAX(r.fechaCreacion) FROM Reporte r GROUP BY r.creadoPor.id")
    List<Object[]> estadisticasPorUsuario();
}

package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.Reporte;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
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

    // Filtros del admin: autorId null = todos los empleados; [desde, hasta) siempre llega (el servicio
    // pone fechas extremas si no se filtra), así PostgreSQL no recibe fechas null sin tipo.
    String FILTROS = """
             WHERE (:autorId IS NULL OR r.creadoPor.id = :autorId)
               AND r.fechaCreacion >= :desde AND r.fechaCreacion < :hasta
            """;

    /**
     * Una página, por hora de captura en campo, de la más nueva a la más vieja. Los
     * reportes viejos sin hora de captura van al final. El admin no carga la historia completa de golpe.
     */
    @Query(value = "SELECT r FROM Reporte r JOIN FETCH r.creadoPor" + FILTROS
            + " ORDER BY r.fechaCaptura DESC NULLS LAST, r.fechaCreacion DESC, r.id DESC",
            countQuery = "SELECT COUNT(r) FROM Reporte r" + FILTROS)
    Page<Reporte> buscarTodos(@Param("autorId") Long autorId, @Param("desde") LocalDateTime desde,
                              @Param("hasta") LocalDateTime hasta, Pageable pagina);

    @Query("SELECT COUNT(DISTINCT r.creadoPor.id) FROM Reporte r" + FILTROS)
    long contarAutores(@Param("autorId") Long autorId, @Param("desde") LocalDateTime desde,
                       @Param("hasta") LocalDateTime hasta);

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

    // Solo los de UNA página del admin (máx. 100 ids, muy lejos del límite de parámetros)
    @Query("SELECT f.reporte.id, COUNT(f) FROM FotoReporte f WHERE f.reporte.id IN :ids GROUP BY f.reporte.id")
    List<Object[]> contarFotosDe(@Param("ids") List<Long> ids);

    @Query("SELECT n.reporte.id, COUNT(n) FROM NotaReporte n WHERE n.reporte.id IN :ids GROUP BY n.reporte.id")
    List<Object[]> contarNotasDe(@Param("ids") List<Long> ids);

    @Query("SELECT f.reporte.id, COUNT(f) FROM FotoReporte f WHERE f.reporte.creadoPor.id = :usuarioId GROUP BY f.reporte.id")
    List<Object[]> contarFotosDeUsuario(@Param("usuarioId") Long usuarioId);

    @Query("SELECT n.reporte.id, COUNT(n) FROM NotaReporte n WHERE n.reporte.creadoPor.id = :usuarioId GROUP BY n.reporte.id")
    List<Object[]> contarNotasDeUsuario(@Param("usuarioId") Long usuarioId);

    /** [usuarioId, cuántos reportes, fecha del último] — para saber si un empleado está activo. */
    @Query("SELECT r.creadoPor.id, COUNT(r), MAX(r.fechaCreacion) FROM Reporte r GROUP BY r.creadoPor.id")
    List<Object[]> estadisticasPorUsuario();
}

package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.NotaQueja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotaQuejaRepository extends JpaRepository<NotaQueja, Long> {

    @Query("""
            SELECT n FROM NotaQueja n
              JOIN FETCH n.autor
            WHERE n.queja.id = :quejaId
            ORDER BY n.fechaCreacion ASC, n.id ASC
            """)
    List<NotaQueja> buscarPorQueja(@Param("quejaId") Long quejaId);
}

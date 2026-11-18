package com.miaa.lecturas.repositories;

import com.miaa.lecturas.entities.EstadoConexion;
import com.miaa.lecturas.entities.UsuarioPresencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

public interface UsuarioPresenciaRepository extends JpaRepository<UsuarioPresencia, Long> {

    /** Los ACTIVO cuyo último latido es anterior a [limite] pasan a [inactivo]. Regresa cuántos. */
    @Transactional
    @Modifying
    @Query("""
            UPDATE UsuarioPresencia p SET p.estadoConexion = :inactivo
             WHERE p.estadoConexion = :activo AND p.ultimaConexionUtc < :limite
            """)
    int marcarInactivos(@Param("limite") Instant limite,
                        @Param("activo") EstadoConexion activo,
                        @Param("inactivo") EstadoConexion inactivo);

    @Transactional
    @Modifying
    @Query("UPDATE UsuarioPresencia p SET p.direccionGeocodificada = :direccion WHERE p.usuarioId = :id")
    int guardarDireccion(@Param("id") Long id, @Param("direccion") String direccion);
}

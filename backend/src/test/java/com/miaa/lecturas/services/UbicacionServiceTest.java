package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.UbicacionEmpleado;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UbicacionEmpleadoRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** El mapa general del admin: todos los notificadores activos, con o sin ubicación. */
class UbicacionServiceTest {

    private static Usuario notificador(long id, String nombre, Boolean habilitado) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setNombre(nombre);
        u.setHabilitado(habilitado);
        return u;
    }

    @Test
    void elMapaGeneralTraeALosActivosYDejaFueraALosDadosDeBaja() {
        UbicacionEmpleadoRepository ubicaciones = mock(UbicacionEmpleadoRepository.class);
        UsuarioRepository usuarios = mock(UsuarioRepository.class);
        when(usuarios.findByRolOrderByNombreAsc(Rol.NOTIFICADOR)).thenReturn(List.of(
                notificador(1, "Ana", null), notificador(2, "Beto", true), notificador(3, "Caro", false)));

        UbicacionEmpleado deAna = new UbicacionEmpleado();
        deAna.setUsuarioId(1L);
        deAna.setLatitud(21.88);
        deAna.setLongitud(-102.29);
        deAna.setFechaRecibida(Instant.now());
        deAna.setCompartiendo(true);
        UbicacionEmpleado deCaro = new UbicacionEmpleado();
        deCaro.setUsuarioId(3L);
        deCaro.setFechaRecibida(Instant.now());
        when(ubicaciones.findAll()).thenReturn(List.of(deAna, deCaro));

        List<UbicacionEmpleadoDTO> todos = new UbicacionService(ubicaciones, usuarios, 60).deTodos();

        assertEquals(List.of("Ana", "Beto"), todos.stream().map(UbicacionEmpleadoDTO::nombre).toList());
        assertTrue(todos.get(0).enLinea());
        assertFalse(todos.get(1).tieneUbicacion()); // Beto sale en la lista aunque nunca haya compartido
    }
}

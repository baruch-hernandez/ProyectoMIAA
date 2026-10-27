package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.CuentaEmpleadoDTO;
import com.miaa.lecturas.dtos.EdicionEmpleadoDTO;
import com.miaa.lecturas.dtos.NuevoEmpleadoDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * El admin asigna el rol (NOTIFICADOR o ADMIN) al dar de alta y al editar, con candados para
 * no quedarse sin administradores. Sin base de datos: el repositorio es un "mock" (Mockito).
 */
class GestionEmpleadosServiceTest {

    private UsuarioRepository repo;
    private UbicacionService ubicacion;
    private GestionEmpleadosService servicio;

    private static final UsuarioPrincipal YO = new UsuarioPrincipal(1L, "admin", "Administrador", "ADMIN");

    @BeforeEach
    void preparar() {
        repo = mock(UsuarioRepository.class);
        ubicacion = mock(UbicacionService.class);
        servicio = new GestionEmpleadosService(repo, mock(PasswordEncoder.class), ubicacion);
        when(repo.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static Usuario usuario(long id, String rol) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setNombre("Usuario " + id);
        u.setUsername("u" + id);
        u.setRol(rol);
        u.setHabilitado(true);
        return u;
    }

    private Usuario registrar(long id, String rol) {
        Usuario u = usuario(id, rol);
        when(repo.findById(id)).thenReturn(Optional.of(u));
        return u;
    }

    private static int status(ResponseStatusException e) {
        return e.getStatusCode().value();
    }

    // ----------------------------- alta -----------------------------
    @Test
    void daDeAltaUnAdministrador() {
        CuentaEmpleadoDTO c = servicio.crear(new NuevoEmpleadoDTO("Ana López", "ana", null, "Temporal2026", "ADMIN"));
        assertEquals("ADMIN", c.rol());
        assertTrue(c.debeCambiarPassword(), "también entra con contraseña temporal");
    }

    @Test
    void sinRolSeDaDeAltaComoNotificador() {
        CuentaEmpleadoDTO c = servicio.crear(new NuevoEmpleadoDTO("Juan", "juan", null, "Temporal2026", null));
        assertEquals("NOTIFICADOR", c.rol());
    }

    @Test
    void unRolInventadoSeRechaza() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> servicio.crear(new NuevoEmpleadoDTO("X", "xx1", null, "Temporal2026", "SUPERUSUARIO")));
        assertEquals(400, status(e));
    }

    // ----------------------------- cambio de rol -----------------------------
    @Test
    void elAdminCambiaElRolDeOtro() {
        Usuario juan = registrar(2L, "NOTIFICADOR");
        servicio.editar(2L, new EdicionEmpleadoDTO("Juan", "u2", null, "ADMIN"), YO);
        assertEquals("ADMIN", juan.getRol());
    }

    @Test
    void sinRolEnLaEdicionSeQuedaElQueTenia() {
        Usuario juan = registrar(2L, "NOTIFICADOR");
        servicio.editar(2L, new EdicionEmpleadoDTO("Juan Pérez", "u2", null, null), YO);
        assertEquals("NOTIFICADOR", juan.getRol());
        assertEquals("Juan Pérez", juan.getNombre());
    }

    @Test
    void nadiePuedeCambiarseSuPropioRol() {
        Usuario yo = registrar(1L, "ADMIN");
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> servicio.editar(1L, new EdicionEmpleadoDTO("Administrador", "admin", null, "NOTIFICADOR"), YO));
        assertEquals(409, status(e));
        assertEquals("ADMIN", yo.getRol());
    }

    @Test
    void siempreDebeQuedarUnAdministradorActivo() {
        Usuario unico = registrar(2L, "ADMIN");
        when(repo.findByRolOrderByNombreAsc("ADMIN")).thenReturn(List.of(unico)); // no hay otro activo
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> servicio.editar(2L, new EdicionEmpleadoDTO("Usuario 2", "u2", null, "NOTIFICADOR"), YO));
        assertEquals(409, status(e));
        assertEquals("ADMIN", unico.getRol());
    }

    // ----------------------------- baja -----------------------------
    @Test
    void nadiePuedeDarseDeBajaASiMismo() {
        registrar(1L, "ADMIN");
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> servicio.cambiarHabilitado(1L, false, YO));
        assertEquals(409, status(e));
    }

    @Test
    void sePuedeDarDeBajaAOtroAdminSiQuedaAlguien() {
        Usuario yo = usuario(1L, "ADMIN");
        Usuario otro = registrar(2L, "ADMIN");
        when(repo.findByRolOrderByNombreAsc("ADMIN")).thenReturn(List.of(yo, otro));
        servicio.cambiarHabilitado(2L, false, YO);
        assertFalse(otro.estaHabilitado());
        verify(ubicacion).marcarDesconectado(2L);
    }

    @Test
    void unUsuarioSinRolValidoNoSeEncuentra() {
        registrar(9L, null);
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> servicio.obtener(9L));
        assertEquals(404, status(e));
    }
}

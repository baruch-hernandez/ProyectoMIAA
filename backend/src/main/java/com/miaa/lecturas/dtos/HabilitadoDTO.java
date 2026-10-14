package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotNull;

/** PUT /usuarios/empleados/{id}/habilitado — false = dar de baja, true = reactivar. */
public record HabilitadoDTO(@NotNull Boolean habilitado) {
}

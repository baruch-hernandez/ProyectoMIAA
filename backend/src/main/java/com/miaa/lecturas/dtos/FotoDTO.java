package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.FotoReporte;
import com.miaa.lecturas.entities.OrigenFechaFoto;

import java.time.Instant;

public record FotoDTO(Long id, String datos, int ancho, int alto,
                      Instant fechaCaptura, OrigenFechaFoto origenFecha, Instant fechaSubida) {

    public static FotoDTO desde(FotoReporte f) {
        return new FotoDTO(f.getId(), f.getDatos(), f.getAncho(), f.getAlto(),
                f.getFechaCaptura(), f.getOrigenFecha(), f.getFechaSubida());
    }
}

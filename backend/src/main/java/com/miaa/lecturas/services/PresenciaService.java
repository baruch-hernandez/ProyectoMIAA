package com.miaa.lecturas.services;
import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.miaa.lecturas.entities.Disponibilidad;
import com.miaa.lecturas.repositories.UsuarioRepository;
import com.miaa.lecturas.entities.Usuario;
import jakarta.transaction.Transactional;

@Service 
public class PresenciaService {
    private final UsuarioRepository usuarioRepository;
    private final long segundosRestantes;
    public PresenciaService(UsuarioRepository usuarioRepository, @Value("${miaa.presencia.segundos-en-linea}") long segundosRestantes){
        this.usuarioRepository = usuarioRepository;
        this.segundosRestantes = segundosRestantes;
    }

    @Transactional 
    public void vidaChecar(@NonNull Long usuarioID){
        usuarioRepository.findById(usuarioID).ifPresent(conectado ->{
            conectado.setConectado(true);
            conectado.setUltimaConexion(LocalDateTime.now());
        });
    }
    @Transactional 
    public void desconectar(@NonNull Long usuarioId){
        usuarioRepository.findById(usuarioId).ifPresent(conectado ->{
            conectado.setConectado(false);
        });
    }
    public Disponibilidad estado(Usuario u) {
        return calcular(u.getConectado(), u.getUltimaConexion(), LocalDateTime.now(), segundosRestantes);
    }

    static Disponibilidad calcular(Boolean conectado, LocalDateTime ultima, LocalDateTime ahora, long segundos) {
        boolean reciente = ultima != null && !ultima.plusSeconds(segundos).isBefore(ahora);
        return Boolean.TRUE.equals(conectado) && reciente ? Disponibilidad.EN_LINEA : Disponibilidad.DESCONECTADO;
    }
}

package com.miaa.lecturas.entities;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;

    private String username;

    private String email;

    // WRITE_ONLY: Jackson puede LEERLO de un JSON que llega, pero NUNCA lo escribe
    // en las respuestas. Antes, GET /rutas regresaba la contraseña del lecturista.
    // (Lo ideal a futuro: no regresar entidades, sino DTOs.)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @ToString.Exclude
    private String password;

    private String rol; // ADMIN, LECTURISTA (ver enum Rol)
}

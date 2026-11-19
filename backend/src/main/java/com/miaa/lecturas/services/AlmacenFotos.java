package com.miaa.lecturas.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Base64;
import java.util.UUID;

/**
 * Las fotos de evidencia viven como ARCHIVOS en una carpeta (miaa.fotos.carpeta); la BD solo guarda
 * el nombre. En la BD como texto base64 pesaban 1/3 más y la tabla crecía ~3 GB al día.
 *
 * Archivo y fila van juntos con la transacción: si se deshace, el archivo nuevo se borra; una foto
 * borrada pierde su archivo solo cuando el borrado se confirma.
 *
 * OJO al respaldar: la carpeta va junto con la base de datos.
 */
@Component
public class AlmacenFotos {

    private final Path carpeta;

    public AlmacenFotos(@Value("${miaa.fotos.carpeta:fotos}") String carpeta) {
        this.carpeta = Path.of(carpeta);
    }

    /** Escribe la imagen y regresa el nombre de su archivo. [tipo]: "png" o "jpeg". */
    public String guardar(byte[] bytes, String tipo) {
        String nombre = UUID.randomUUID() + ("png".equals(tipo) ? ".png" : ".jpg");
        Path archivo = carpeta.resolve(nombre);
        try {
            Files.createDirectories(carpeta);
            Files.write(archivo, bytes, StandardOpenOption.CREATE_NEW);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la foto " + archivo.toAbsolutePath(), e);
        }
        alTerminar(TransactionSynchronization.STATUS_ROLLED_BACK, archivo);
        return nombre;
    }

    /** La foto como data URL ("data:image/jpeg;base64,..."), como la reciben la web y la app. */
    public String dataUrl(String nombre) {
        try {
            byte[] bytes = Files.readAllBytes(carpeta.resolve(nombre));
            return "data:image/" + (nombre.endsWith(".png") ? "png" : "jpeg") + ";base64,"
                    + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer la foto " + nombre, e);
        }
    }

    /** Borra el archivo cuando se confirme la transacción (si se deshace, la foto sigue ahí). */
    public void borrar(String nombre) {
        Path archivo = carpeta.resolve(nombre);
        if (!alTerminar(TransactionSynchronization.STATUS_COMMITTED, archivo)) {
            borrarYa(archivo); // sin transacción: ya
        }
    }

    /** Borra [archivo] cuando la transacción actual termine con [estado]. false si no hay transacción. */
    private static boolean alTerminar(int estado, Path archivo) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return false;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == estado) borrarYa(archivo);
            }
        });
        return true;
    }

    private static void borrarYa(Path archivo) {
        try {
            Files.deleteIfExists(archivo);
        } catch (IOException e) {
            // Solo queda un archivo huérfano en disco; la BD ya está bien
        }
    }
}

package com.miaa.lecturas.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Base64;
import java.util.List;
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

    /** Borra el archivo (y su miniatura) cuando se confirme la transacción (si se deshace, la foto sigue ahí). */
    public void borrar(String nombre) {
        for (Path archivo : List.of(carpeta.resolve(nombre), rutaMiniatura(nombre))) {
            if (!alTerminar(TransactionSynchronization.STATUS_COMMITTED, archivo)) {
                borrarYa(archivo); // sin transacción: ya
            }
        }
    }

    /** Lado largo de la miniatura del listado: ~10-20 KB en vez de ~1 MB por foto. */
    static final int LADO_MINIATURA = 320;

    /** La miniatura JPEG de la foto [nombre]: se hace la primera vez que se pide y se queda en disco. */
    public byte[] miniatura(String nombre) {
        Path mini = rutaMiniatura(nombre);
        try {
            if (Files.exists(mini)) {
                return Files.readAllBytes(mini);
            }
            byte[] bytes = reducir(Files.readAllBytes(carpeta.resolve(nombre)));
            // A un archivo temporal y luego se renombra: dos peticiones a la vez nunca leen una a medias
            Path temporal = Files.createTempFile(carpeta, "mini-", ".tmp");
            Files.write(temporal, bytes);
            Files.move(temporal, mini, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            return bytes;
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo hacer la miniatura de " + nombre, e);
        }
    }

    private Path rutaMiniatura(String nombre) {
        return carpeta.resolve(nombre.substring(0, nombre.lastIndexOf('.')) + "-mini.jpg");
    }

    /** La imagen reducida a [LADO_MINIATURA] px de lado largo, en JPEG (las PNG quedan con fondo blanco). */
    public static byte[] reducir(byte[] original) {
        try {
            BufferedImage imagen = ImageIO.read(new ByteArrayInputStream(original));
            if (imagen == null) {
                throw new IOException("No es una imagen que Java sepa leer");
            }
            double escala = Math.min(1.0, (double) LADO_MINIATURA / Math.max(imagen.getWidth(), imagen.getHeight()));
            int ancho = Math.max(1, (int) Math.round(imagen.getWidth() * escala));
            int alto = Math.max(1, (int) Math.round(imagen.getHeight() * escala));
            BufferedImage mini = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = mini.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.drawImage(imagen, 0, 0, ancho, alto, Color.WHITE, null);
            } finally {
                g.dispose();
            }
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            ImageIO.write(mini, "jpg", salida);
            return salida.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo reducir la foto", e);
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

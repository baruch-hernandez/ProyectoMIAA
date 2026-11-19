package com.miaa.lecturas.services;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Las fotos en disco: lo que se guarda es lo que se devuelve, y el archivo sigue a la transacción. */
class AlmacenFotosTest {

    private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 1, 2, 3 };

    @Test
    void laFotoRegresaIgualComoDataUrlConSuTipo(@TempDir Path carpeta) {
        AlmacenFotos almacen = new AlmacenFotos(carpeta.toString());

        String url = almacen.dataUrl(almacen.guardar(PNG, "png"));

        assertTrue(url.startsWith("data:image/png;base64,"), url);
        assertArrayEquals(PNG, Base64.getDecoder().decode(url.split(",", 2)[1]));
        assertTrue(almacen.dataUrl(almacen.guardar(PNG, "jpeg")).startsWith("data:image/jpeg;base64,"));
    }

    @Test
    void siLaTransaccionSeDeshaceNoQuedaElArchivo(@TempDir Path carpeta) throws Exception {
        AlmacenFotos almacen = new AlmacenFotos(carpeta.toString());
        TransactionSynchronizationManager.initSynchronization();
        try {
            String nombre = almacen.guardar(PNG, "jpeg");
            assertTrue(Files.exists(carpeta.resolve(nombre)));

            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

            assertFalse(Files.exists(carpeta.resolve(nombre)));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void unaFotoBorradaSoloPierdeSuArchivoAlConfirmar(@TempDir Path carpeta) throws Exception {
        AlmacenFotos almacen = new AlmacenFotos(carpeta.toString());
        String nombre = almacen.guardar(PNG, "jpeg"); // sin transacción: se queda
        TransactionSynchronizationManager.initSynchronization();
        try {
            almacen.borrar(nombre);
            assertTrue(Files.exists(carpeta.resolve(nombre)), "antes de confirmar, sigue ahí");

            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));

            assertFalse(Files.exists(carpeta.resolve(nombre)));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}

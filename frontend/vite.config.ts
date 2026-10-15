import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * `npm run dev:https` (modo "https") sirve el front con HTTPS usando el MISMO certificado
 * que el backend (backend/certificados/miaa-dev.p12, lo crea backend/generar-certificado.ps1).
 * Hace falta para probar el GPS desde el celular: el navegador solo da la ubicación en https.
 */
function httpsDesarrollo() {
  const certificado = fileURLToPath(new URL('../backend/certificados/miaa-dev.p12', import.meta.url))
  if (!existsSync(certificado)) {
    throw new Error(`No existe ${certificado}. Córrelo primero: backend\\generar-certificado.ps1`)
  }
  return { pfx: readFileSync(certificado), passphrase: process.env.MIAA_KEYSTORE_PASSWORD ?? 'miaa-dev' }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const conHttps = mode === 'https'
  // A dónde reenvía Vite las peticiones /api/... (el backend en ESTA misma PC).
  // Con el perfil "https" del backend es https://; sin él, http://. Se puede cambiar con MIAA_API_DESTINO.
  const destinoApi = process.env.MIAA_API_DESTINO ?? (conHttps ? 'https://localhost:8500' : 'http://localhost:8500')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      ...(conHttps ? { https: httpsDesarrollo() } : {}),
      host: true, // accesible desde otros equipos y el celular (muestra la URL "Network")
      // Proxy: el navegador le pide /api/... a Vite (mismo origen que la página) y Vite lo
      // reenvía al backend. Para el navegador todo es UN solo sitio: no hay CORS, no importa
      // la IP de la PC y solo se acepta UN certificado (el de esta página).
      proxy: {
        '/api': {
          target: destinoApi,
          changeOrigin: true,
          secure: false, // el certificado del backend es autofirmado (solo desarrollo)
          // El navegador manda "Origin: https://<ip>:5173" incluso a su mismo sitio (en los POST).
          // Spring lo compararía contra miaa.cors.origenes y podría rechazarlo con 403
          // "Invalid CORS request". Para el backend esta petición viene de Vite, no de otro sitio.
          configure: (proxy) => {
            proxy.on('proxyReq', (peticion) => peticion.removeHeader('origin'))
          },
        },
      },
    },
  }
})

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
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: mode === 'https'
    ? { https: httpsDesarrollo(), host: true } // host: true → accesible desde el celular en la misma red
    : undefined,
}))

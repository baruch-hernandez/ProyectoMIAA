import { useState } from 'react';

interface MarcaProps {
  /** "claro" para fondos blancos, "oscuro" para fondos marino. */
  tono?: 'claro' | 'oscuro';
  className?: string;
}

/**
 * Logotipo de MIAA.
 *
 * Coloca el archivo OFICIAL del logo (pídelo a Comunicación de MIAA) en:
 *   frontend/public/logo-miaa.png          (versión para fondo claro)
 *   frontend/public/logo-miaa-blanco.png   (versión para fondo marino)
 *
 * Mientras no exista el archivo, se muestra el nombre en texto.
 */
export function Marca({ tono = 'claro', className = '' }: MarcaProps) {
  const [sinImagen, setSinImagen] = useState(false);
  // Lo que está en frontend/public se sirve desde la RAÍZ: public/miaaLogo.png → /miaaLogo.png
  const src = '/miaaLogo.png';

  if (!sinImagen) {
    return (
      <img
        src={src}
        alt="MIAA, Modelo Integral de Aguas de Aguascalientes"
        className={`h-10 w-auto ${className}`}
        onError={() => setSinImagen(true)}
      />
    );
  }

  const colorNombre = tono === 'oscuro' ? 'text-white' : 'text-miaa-azul';
  const colorSub = tono === 'oscuro' ? 'text-miaa-bruma' : 'text-miaa-marino';

  return (
    <span className={`inline-flex flex-col leading-none ${className}`} aria-label="MIAA, Modelo Integral de Aguas de Aguascalientes">
      <span className={`text-2xl font-extrabold tracking-tight ${colorNombre}`}>MIAA</span>
      <span className={`mt-1 text-[0.65rem] font-semibold ${colorSub}`}>Modelo Integral de Aguas de Aguascalientes</span>
    </span>
  );
}

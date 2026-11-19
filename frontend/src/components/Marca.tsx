interface MarcaProps {
  /** "claro" para fondos blancos (logo azul), "oscuro" para fondos marino (logo blanco). */
  tono?: 'claro' | 'oscuro';
  /** Alto del logo (clases de Tailwind). */
  className?: string;
}

/**
 * Logotipo oficial de MIAA (frontend/public/logo-miaa.svg, de un solo color: azul #4476AB).
 * Sobre marino se pinta blanco con un filtro, así no hace falta una segunda versión del archivo.
 */
export function Marca({ tono = 'claro', className = 'h-12' }: MarcaProps) {
  return (
    <img
      src="/logo-miaa.svg"
      alt="MIAA, Modelo Integral de Aguas de Aguascalientes"
      className={`w-auto shrink-0 ${tono === 'oscuro' ? 'brightness-0 invert' : ''} ${className}`}
    />
  );
}

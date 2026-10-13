import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  src: string;
  /** Texto debajo de la foto, p. ej. "Tomada 9 oct 2026, 14:02 · 1920×1080" */
  pie?: string;
  onCerrar: () => void;
}

/** Foto a pantalla completa. Se cierra con la X, tocando fuera o con Escape. */
export function VisorFoto({ src, pie, onCerrar }: Props) {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 bg-miaa-marino/90 flex flex-col items-center justify-center gap-3 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Foto de evidencia"
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar foto"
        autoFocus
        className="absolute top-4 right-4 size-11 grid place-items-center rounded-full bg-white text-miaa-marino"
      >
        <X size={22} aria-hidden="true" />
      </button>
      <img src={src} alt="Evidencia ampliada" className="max-h-[85dvh] max-w-full rounded-xl" />
      {pie && <p className="text-sm font-medium text-white/90">{pie}</p>}
    </div>
  );
}

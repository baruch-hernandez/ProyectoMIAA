import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { cuentaApi } from '../../services/cuentaApi';
import { leerError } from '../../services/reportesApi';
import type { Cuenta } from '../../types/reporte';
import { claseInput } from '../../utils/estilos';
import { reglasPassword } from '../../utils/password';

interface Props {
  /** "Contraseña temporal" cuando el admin se la acaba de dar; "Contraseña actual" si no. */
  etiquetaActual: string;
  onListo: (cuenta: Cuenta) => void;
}

export function FormCambioPassword({ etiquetaActual, onListo }: Props) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reglas = reglasPassword(nueva, confirmacion);
  const listo = actual.length > 0 && reglas.every((r) => r.ok);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!listo) return;
    setEnviando(true);
    setError(null);
    try {
      onListo(await cuentaApi.cambiarPassword(actual, nueva));
    } catch (err) {
      setError(leerError(err).mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const tipo = ver ? 'text' : 'password';

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label htmlFor="pw-actual" className="block text-sm font-semibold text-miaa-marino mb-1.5">{etiquetaActual}</label>
        <input id="pw-actual" type={tipo} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required className={claseInput} />
      </div>
      <div>
        <label htmlFor="pw-nueva" className="block text-sm font-semibold text-miaa-marino mb-1.5">Nueva contraseña</label>
        <input id="pw-nueva" type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required maxLength={72} className={claseInput} />
      </div>
      <div>
        <label htmlFor="pw-confirmar" className="block text-sm font-semibold text-miaa-marino mb-1.5">Repite la nueva contraseña</label>
        <input id="pw-confirmar" type={tipo} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" required maxLength={72} className={claseInput} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <ul className="space-y-1 text-sm" aria-label="Requisitos de la contraseña">
          {reglas.map((r) => (
            <li key={r.texto} className={`flex items-center gap-1.5 ${r.ok ? 'text-[#0b6b58]' : 'text-slate-500'}`}>
              <Check size={15} className={r.ok ? '' : 'opacity-30'} aria-hidden="true" />
              {r.texto}
              <span className="sr-only">{r.ok ? '(cumple)' : '(falta)'}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setVer((v) => !v)} className="inline-flex items-center gap-1.5 h-9 px-2 rounded-lg text-sm font-semibold text-miaa-azul hover:bg-slate-100 shrink-0">
          {ver ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {ver ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {error && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={!listo || enviando}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors"
      >
        {enviando && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        {enviando ? 'Guardando…' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}

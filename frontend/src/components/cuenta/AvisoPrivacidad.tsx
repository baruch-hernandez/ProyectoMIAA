import { useState } from 'react';
import { LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cuentaApi } from '../../services/cuentaApi';
import { leerError } from '../../services/reportesApi';
import type { Cuenta } from '../../types/reporte';
import { AVISO_ES_BORRADOR, AVISO_PRIVACIDAD, VERSION_AVISO } from '../../utils/avisoPrivacidad';

/**
 * El lecturista lee el aviso y lo acepta. El backend guarda la fecha y la versión;
 * si MIAA cambia el texto (y la versión), se le vuelve a pedir.
 */
export function AvisoPrivacidad({ onAceptado }: { onAceptado: (cuenta: Cuenta) => void }) {
  const [leido, setLeido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aceptar = async () => {
    setEnviando(true);
    setError(null);
    try {
      onAceptado(await cuentaApi.aceptarAviso(VERSION_AVISO));
    } catch (err) {
      setError(leerError(err).mensaje);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      {AVISO_ES_BORRADOR && (
        <p className="flex items-start gap-1.5 rounded-lg bg-[#fff4cc] px-3 py-2 text-xs font-medium text-[#7a5600]">
          <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
          Borrador pendiente de revisión por el área jurídica de MIAA.
        </p>
      )}

      <div className="max-h-[50dvh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 text-sm leading-relaxed text-slate-700" tabIndex={0} aria-label="Texto del aviso de privacidad">
        {AVISO_PRIVACIDAD.map((s) => (
          <section key={s.titulo}>
            <h3 className="font-bold text-miaa-marino">{s.titulo}</h3>
            {s.parrafos.map((p) => <p key={p} className="mt-1">{p}</p>)}
          </section>
        ))}
        <p className="text-xs text-slate-500">Versión {VERSION_AVISO}</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-800">
        <input type="checkbox" checked={leido} onChange={(e) => setLeido(e.target.checked)} className="mt-0.5 size-5 accent-miaa-marino" />
        Leí el aviso de privacidad y acepto el uso de mis datos para las finalidades descritas.
      </label>

      {error && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800" role="alert">{error}</p>}

      <button
        type="button"
        onClick={aceptar}
        disabled={!leido || enviando}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors"
      >
        {enviando ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
        {enviando ? 'Guardando…' : 'Aceptar y continuar'}
      </button>
    </div>
  );
}

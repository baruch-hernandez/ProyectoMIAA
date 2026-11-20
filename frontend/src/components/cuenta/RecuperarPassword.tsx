import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, CircleCheck, Eye, EyeOff, LoaderCircle, Mail } from 'lucide-react';
import { cuentaApi } from '../../services/cuentaApi';
import { leerError } from '../../services/reportesApi';
import { claseInput } from '../../utils/estilos';
import { reglasPassword } from '../../utils/password';
import { Marca } from '../Marca';

type Paso = 'pedir' | 'codigo' | 'listo';

const claseBoton =
  'w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors';
const claseEtiqueta = 'block text-sm font-semibold text-miaa-marino mb-1.5';

/**
 * "¿Olvidaste tu contraseña?" (sin sesión): 1) usuario o correo → llega un código de 6 dígitos al
 * correo de la cuenta; 2) código + contraseña nueva. El backend nunca dice si la cuenta existe.
 */
export function RecuperarPassword() {
  const desdeLogin = (useLocation().state as { usuario?: string } | null)?.usuario ?? '';
  const [paso, setPaso] = useState<Paso>('pedir');
  const [usuario, setUsuario] = useState(desdeLogin);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);

  const reglas = reglasPassword(nueva, confirmacion);
  const listoParaCambiar = /^\d{6}$/.test(codigo) && reglas.every((r) => r.ok);

  const ejecutar = async (accion: () => Promise<void>) => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
    } catch (err) {
      setError(leerError(err).mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const pedirCodigo = (e?: FormEvent) => {
    e?.preventDefault();
    void ejecutar(async () => {
      await cuentaApi.olvidePassword(usuario.trim());
      setReenviado(paso === 'codigo');
      setPaso('codigo');
    });
  };

  const cambiar = (e: FormEvent) => {
    e.preventDefault();
    if (!listoParaCambiar) return;
    void ejecutar(async () => {
      await cuentaApi.restablecerPassword(usuario.trim(), codigo, nueva);
      setPaso('listo');
    });
  };

  const tipo = ver ? 'text' : 'password';

  return (
    <div className="min-h-dvh bg-miaa-fondo flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-lg shadow-miaa-marino/10">
        <Marca className="h-12" />
        <h1 className="mt-6 text-2xl font-extrabold text-miaa-marino">Restablecer contraseña</h1>

        {paso === 'pedir' && (
          <form onSubmit={pedirCodigo} className="mt-4 space-y-5">
            <p className="text-sm text-slate-600">
              Escribe tu usuario o tu correo. Te mandaremos un código de 6 dígitos al correo registrado en tu cuenta.
            </p>
            <div>
              <label htmlFor="rec-usuario" className={claseEtiqueta}>Usuario o correo</label>
              <input id="rec-usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username"
                autoCapitalize="none" spellCheck={false} required maxLength={150} className={claseInput} />
            </div>
            {error && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800" role="alert">{error}</p>}
            <button type="submit" disabled={enviando || !usuario.trim()} className={claseBoton}>
              {enviando ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
              Enviarme un código
            </button>
          </form>
        )}

        {paso === 'codigo' && (
          <form onSubmit={cambiar} className="mt-4 space-y-4">
            <p className="p-3 rounded-xl bg-blue-50 text-sm text-miaa-marino" role="status">
              {reenviado ? 'Te mandamos otro código. ' : ''}
              Si <b>{usuario.trim()}</b> tiene un correo registrado, le llegó un código que vence en 15 minutos.
              Revisa también la carpeta de spam.
            </p>
            <div>
              <label htmlFor="rec-codigo" className={claseEtiqueta}>Código de 6 dígitos</label>
              <input id="rec-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" autoComplete="one-time-code" required className={`${claseInput} tracking-[0.4em] tabular-nums`} />
            </div>
            <div>
              <label htmlFor="rec-nueva" className={claseEtiqueta}>Nueva contraseña</label>
              <input id="rec-nueva" type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required maxLength={72} className={claseInput} />
            </div>
            <div>
              <label htmlFor="rec-confirmar" className={claseEtiqueta}>Repite la nueva contraseña</label>
              <input id="rec-confirmar" type={tipo} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" required maxLength={72} className={claseInput} />
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
            <button type="submit" disabled={!listoParaCambiar || enviando} className={claseBoton}>
              {enviando && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
              Cambiar contraseña
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => pedirCodigo()} disabled={enviando} className="font-semibold text-miaa-azul hover:underline disabled:opacity-50">
                Mandar otro código
              </button>
              <button type="button" onClick={() => { setPaso('pedir'); setError(null); setCodigo(''); }} className="font-semibold text-slate-600 hover:underline">
                Cambiar usuario
              </button>
            </div>
          </form>
        )}

        {paso === 'listo' && (
          <div className="mt-4 space-y-5" role="status">
            <p className="flex items-start gap-2 p-3 rounded-xl bg-[#d3fbf2] text-[#0b6b58] font-medium">
              <CircleCheck size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
              Tu contraseña se cambió. Ya puedes entrar con ella.
            </p>
            <Link to="/" className={claseBoton}>Ir a iniciar sesión</Link>
          </div>
        )}

        {paso !== 'listo' && (
          <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-miaa-azul hover:underline">
            <ArrowLeft size={16} aria-hidden="true" /> Volver a iniciar sesión
          </Link>
        )}
      </div>
    </div>
  );
}

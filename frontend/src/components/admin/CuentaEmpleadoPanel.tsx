import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Copy, KeyRound, LoaderCircle, LockOpen, Pencil, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { usuariosApi } from '../../services/usuariosApi';
import { leerError } from '../../services/reportesApi';
import type { CuentaEmpleado } from '../../types/reporte';
import { formatoFecha } from '../../utils/catalogos';
import { claseInput } from '../../utils/estilos';
import { cumplePolitica, generarPasswordTemporal } from '../../utils/password';
import { Campo } from '../reportes/Formulario';
import { obtenerUsuario } from '../../utils/sesion';
import type { RolUsuario } from '../../utils/sesion';
import { nombreRol } from '../../utils/roles';
import { SelectorRol } from './SelectorRol';

type Modo = 'ver' | 'editar' | 'password' | 'baja';

/**
 * Cuenta del empleado en su ficha: datos, rol, editar, restablecer contraseña y dar de baja.
 * Dar de baja NO borra: ya no puede entrar, pero sus reportes se conservan.
 * El backend impide cambiarse el propio rol, darse de baja a uno mismo y quedarse sin administradores;
 * aquí solo se esconden esas opciones para no ofrecer algo que va a fallar.
 */
export function CuentaEmpleadoPanel({ id, onRol }: { id: number; onRol?: (rol: RolUsuario) => void }) {
  const [cuenta, setCuenta] = useState<CuentaEmpleado | null>(null);
  const [modo, setModo] = useState<Modo>('ver');
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Formularios
  const [form, setForm] = useState<{ nombre: string; username: string; email: string; rol: RolUsuario }>(
    { nombre: '', username: '', email: '', rol: 'NOTIFICADOR' });
  const esYo = obtenerUsuario()?.id === id;
  const [temporal, setTemporal] = useState('');
  const [temporalDada, setTemporalDada] = useState<string | null>(null);

  useEffect(() => {
    let ignorar = false;
    usuariosApi
      .cuenta(id)
      .then((c) => { if (!ignorar) setCuenta(c); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); });
    return () => { ignorar = true; };
  }, [id]);

  // Avisar a la ficha qué rol tiene (a los administradores no se les muestra el mapa)
  const rolActual = cuenta?.rol;
  useEffect(() => {
    if (rolActual) onRol?.(rolActual);
  }, [rolActual, onRol]);

  const abrir = (m: Modo) => {
    setError(null);
    setErrores({});
    setAviso(null);
    setTemporalDada(null);
    if (m === 'editar' && cuenta) setForm({ nombre: cuenta.nombre, username: cuenta.username, email: cuenta.email ?? '', rol: cuenta.rol });
    if (m === 'password') setTemporal(generarPasswordTemporal());
    setModo(m);
  };

  /** Ejecuta una acción, actualiza la cuenta y regresa a "ver". Regresa true si salió bien. */
  const hacer = async (accion: () => Promise<CuentaEmpleado>, mensaje: string): Promise<boolean> => {
    setGuardando(true);
    setError(null);
    setErrores({});
    try {
      setCuenta(await accion());
      setAviso(mensaje);
      setModo('ver');
      return true;
    } catch (err) {
      const { mensaje: m, errores: e } = leerError(err);
      setError(m);
      setErrores(e);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const guardarDatos = (e: FormEvent) => {
    e.preventDefault();
    hacer(() => usuariosApi.editar(id, form), 'Datos actualizados.');
  };

  const restablecer = async (e: FormEvent) => {
    e.preventDefault();
    const valor = temporal;
    if (await hacer(() => usuariosApi.restablecerPassword(id, valor), 'Contraseña restablecida.')) {
      setTemporalDada(valor);
    }
  };

  if (!cuenta) {
    return error
      ? <p className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</p>
      : <div className="h-28 rounded-2xl bg-white/70 animate-pulse" aria-busy="true" />;
  }

  const botonSecundario = 'inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold transition-colors';

  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6" aria-labelledby="titulo-cuenta">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-cuenta" className="text-lg font-extrabold text-miaa-marino">Cuenta</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Estado</dt>
            <dd>
              {cuenta.habilitado
                ? <span className="font-semibold text-[#0b6b58]">Habilitada</span>
                : <span className="font-semibold text-red-700">Dada de baja</span>}
              {cuenta.debeCambiarPassword && <span className="text-slate-500"> · debe cambiar su contraseña temporal</span>}
              {cuenta.bloqueadoHasta && (
                <span className="block font-semibold text-[#7a5600]">
                  Bloqueada por intentos fallidos hasta el {formatoFecha(cuenta.bloqueadoHasta)}
                </span>
              )}
            </dd>
            <dt className="text-slate-500">Rol</dt>
            <dd className="font-semibold text-miaa-marino">
              {nombreRol(cuenta.rol)}
              {esYo && <span className="font-normal text-slate-500"> · eres tú</span>}
            </dd>
            <dt className="text-slate-500">Usuario</dt>
            <dd className="text-slate-800">{cuenta.username}</dd>
            <dt className="text-slate-500">Correo</dt>
            <dd className="text-slate-800">{cuenta.email ?? '—'}</dd>
            {cuenta.rol === 'NOTIFICADOR' && (
              <>
                <dt className="text-slate-500">Aviso de privacidad</dt>
                <dd className="text-slate-800">{cuenta.avisoPrivacidadFecha ? `Aceptado ${formatoFecha(cuenta.avisoPrivacidadFecha)}` : 'Aún no lo acepta'}</dd>
              </>
            )}
            {cuenta.fechaAlta && (<><dt className="text-slate-500">Alta</dt><dd className="text-slate-800">{formatoFecha(cuenta.fechaAlta)}</dd></>)}
          </dl>
        </div>

        {modo === 'ver' && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => abrir('editar')} className={`${botonSecundario} text-miaa-azul hover:bg-blue-50`}>
              <Pencil size={15} aria-hidden="true" /> Editar datos
            </button>
            {cuenta.bloqueadoHasta && (
              <button type="button" disabled={guardando}
                onClick={() => hacer(() => usuariosApi.desbloquear(id), 'Cuenta desbloqueada: ya puede volver a intentar.')}
                className={`${botonSecundario} text-[#7a5600] hover:bg-amber-50`}>
                <LockOpen size={15} aria-hidden="true" /> Desbloquear
              </button>
            )}
            <button type="button" onClick={() => abrir('password')} className={`${botonSecundario} text-miaa-azul hover:bg-blue-50`}>
              <KeyRound size={15} aria-hidden="true" /> Restablecer contraseña
            </button>
            {esYo ? null : cuenta.habilitado ? (
              <button type="button" onClick={() => abrir('baja')} className={`${botonSecundario} text-red-700 hover:bg-red-50`}>
                <UserX size={15} aria-hidden="true" /> Dar de baja
              </button>
            ) : (
              <button type="button" disabled={guardando}
                onClick={() => hacer(() => usuariosApi.cambiarHabilitado(id, true), 'Cuenta reactivada: ya puede volver a entrar.')}
                className={`${botonSecundario} text-[#0b6b58] hover:bg-[#d3fbf2]`}>
                <UserCheck size={15} aria-hidden="true" /> Reactivar
              </button>
            )}
          </div>
        )}
      </div>

      {aviso && modo === 'ver' && (
        <div className="mt-4 rounded-xl bg-[#d3fbf2] px-3 py-2 text-sm font-medium text-[#0b6b58]" role="status">
          {aviso}
          {temporalDada && (
            <span className="block mt-1">
              Dale esta contraseña temporal: <code className="cifras font-bold">{temporalDada}</code>{' '}
              <button type="button" onClick={() => navigator.clipboard?.writeText(temporalDada).catch(() => undefined)}
                className="inline-flex items-center gap-1 font-semibold underline"><Copy size={13} aria-hidden="true" />Copiar</button>
              <span className="block text-xs">Al entrar, la app le pedirá crear una nueva.</span>
            </span>
          )}
        </div>
      )}
      {error && <p className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800" role="alert">{error}</p>}

      {modo === 'editar' && (
        <form onSubmit={guardarDatos} className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo id="ed-nombre" etiqueta="Nombre completo" error={errores.nombre} className="sm:col-span-2">
            <input id="ed-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required maxLength={100} className={claseInput} />
          </Campo>
          <Campo id="ed-username" etiqueta="Usuario" error={errores.username}>
            <input id="ed-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required pattern="[A-Za-z0-9._\-]{3,30}" className={claseInput} />
          </Campo>
          <Campo id="ed-email" etiqueta="Correo" opcional error={errores.email}>
            <input id="ed-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={120} className={claseInput} />
          </Campo>
          <div className="sm:col-span-2">
            <SelectorRol
              id="ed"
              valor={form.rol}
              onChange={(rol) => setForm({ ...form, rol })}
              deshabilitado={esYo}
              nota={esYo ? 'No puedes cambiar tu propio rol: pídeselo a otro administrador.' : undefined}
            />
            {form.rol !== cuenta.rol && (
              <p className="mt-2 rounded-xl bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-[#6b4a00]" role="note">
                El cambio aplica <strong>de inmediato</strong>:{' '}
                {form.rol === 'ADMIN'
                  ? 'podrá entrar a este panel y administrar a todos los empleados.'
                  : 'ya no podrá entrar al panel web; usará la app del celular.'}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={guardando} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-50">
              {guardando && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />} Guardar
            </button>
            <button type="button" onClick={() => setModo('ver')} className="h-11 px-4 rounded-xl font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button>
          </div>
        </form>
      )}

      {modo === 'password' && (
        <form onSubmit={restablecer} className="mt-5 space-y-3">
          <p className="text-sm text-slate-700">
            Pon una contraseña temporal y dásela a {cuenta.nombre.split(' ')[0]}. Su contraseña anterior deja de servir y,
            al entrar, la app le pedirá crear una nueva.
          </p>
          <div className="flex gap-2 max-w-md">
            <label htmlFor="temporal" className="sr-only">Contraseña temporal</label>
            <input id="temporal" value={temporal} onChange={(e) => setTemporal(e.target.value)} required maxLength={72} className={`${claseInput} cifras`} />
            <button type="button" onClick={() => setTemporal(generarPasswordTemporal())} className={`${botonSecundario} h-12 text-miaa-azul hover:bg-blue-50 shrink-0`}>
              <RefreshCw size={15} aria-hidden="true" /> Otra
            </button>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={guardando || !cumplePolitica(temporal)} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-50">
              {guardando && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />} Restablecer
            </button>
            <button type="button" onClick={() => setModo('ver')} className="h-11 px-4 rounded-xl font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button>
          </div>
        </form>
      )}

      {modo === 'baja' && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm text-red-900">
            <strong>¿Dar de baja a {cuenta.nombre}?</strong> Ya no podrá iniciar sesión y, si está usando la app, se le
            cerrará en su siguiente acción. Sus reportes <strong>se conservan</strong>. Puedes reactivarlo después.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={guardando}
              onClick={() => hacer(() => usuariosApi.cambiarHabilitado(id, false), 'Cuenta dada de baja.')}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-50">
              {guardando && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />} Sí, dar de baja
            </button>
            <button type="button" onClick={() => setModo('ver')} className="h-11 px-4 rounded-xl font-semibold text-slate-700 hover:bg-white">Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck, Copy, LoaderCircle, RefreshCw, UserPlus } from 'lucide-react';
import { usuariosApi } from '../../services/usuariosApi';
import { leerError } from '../../services/reportesApi';
import type { CuentaEmpleado } from '../../types/reporte';
import { claseInput } from '../../utils/estilos';
import { cumplePolitica, generarPasswordTemporal } from '../../utils/password';
import { Campo } from '../reportes/Formulario';
import type { RolUsuario } from '../../utils/sesion';
import { SelectorRol } from './SelectorRol';

/** "Juan Pérez López" → "juan.perez": sugerencia de usuario (se puede cambiar). */
function sugerirUsuario(nombre: string): string {
  const partes = nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).join('.').slice(0, 30);
}

/** Alta de un empleado con su rol (notificador o administrador) y una contraseña TEMPORAL que cambiará al entrar. */
export function NuevoEmpleado() {
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolUsuario>('NOTIFICADOR');
  const [password, setPassword] = useState(generarPasswordTemporal);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState<{ cuenta: CuentaEmpleado; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cambiarNombre = (valor: string) => {
    setNombre(valor);
    if (!usuarioEditado) setUsername(sugerirUsuario(valor)); // sugiere mientras no lo escriban a mano
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setErrores({});
    try {
      const cuenta = await usuariosApi.crear({ nombre, username, email, passwordTemporal: password, rol });
      setCreado({ cuenta, password });
    } catch (err) {
      const { mensaje, errores: porCampo } = leerError(err);
      setError(mensaje);
      setErrores(porCampo);
    } finally {
      setEnviando(false);
    }
  };

  const otro = () => {
    setCreado(null);
    setNombre('');
    setUsername('');
    setUsuarioEditado(false);
    setEmail('');
    setRol('NOTIFICADOR');
    setPassword(generarPasswordTemporal());
    setCopiado(false);
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      /* sin permiso de portapapeles: que lo copien a mano */
    }
  };

  return (
    <div className="max-w-xl">
      <Link to="/admin/empleados" className="inline-flex items-center gap-1.5 h-10 text-sm font-semibold text-miaa-azul hover:text-miaa-marino">
        <ArrowLeft size={18} aria-hidden="true" /> Empleados
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold text-miaa-marino">Nuevo empleado</h1>
      <p className="mt-1 text-slate-600">Elige su rol y dale una contraseña temporal. Al entrar por primera vez creará la suya.</p>

      {creado ? (
        <section className="mt-6 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4" role="status">
          <p className="flex items-start gap-2 font-bold text-[#0b6b58]">
            <CircleCheck size={22} className="shrink-0" aria-hidden="true" /> {creado.cuenta.nombre} ya puede entrar.
          </p>
          <p className="text-slate-700">
            Dale estos datos. Entra como <strong>{creado.cuenta.rol === 'ADMIN' ? 'administrador, en este panel web' : 'notificador, en la app del celular'}</strong>.
            La contraseña es temporal: al entrar se le pedirá crear una nueva.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <dt className="text-slate-500">Usuario</dt>
            <dd className="font-bold text-miaa-marino">{creado.cuenta.username}</dd>
            <dt className="text-slate-500">Contraseña temporal</dt>
            <dd className="flex items-center gap-2">
              <code className="cifras font-bold text-miaa-marino">{creado.password}</code>
              <button type="button" onClick={() => copiar(`Usuario: ${creado.cuenta.username}\nContraseña temporal: ${creado.password}`)}
                className="inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-miaa-azul hover:bg-blue-50">
                <Copy size={14} aria-hidden="true" /> {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/empleados/${creado.cuenta.id}`} className="inline-flex items-center h-11 px-4 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800">
              Ver su ficha
            </Link>
            <button type="button" onClick={otro} className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl font-semibold text-miaa-azul hover:bg-blue-50">
              <UserPlus size={17} aria-hidden="true" /> Dar de alta a otro
            </button>
          </div>
        </section>
      ) : (
        <form onSubmit={enviar} className="mt-6 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4">
          {error && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800" role="alert">{error}</p>}

          <Campo id="nombre" etiqueta="Nombre completo" error={errores.nombre}>
            <input id="nombre" value={nombre} onChange={(e) => cambiarNombre(e.target.value)} required maxLength={100} autoComplete="off" className={claseInput} />
          </Campo>
          <Campo id="username" etiqueta="Usuario" error={errores.username}>
            <input id="username" value={username} onChange={(e) => { setUsername(e.target.value); setUsuarioEditado(true); }}
              required pattern="[A-Za-z0-9._\-]{3,30}" title="De 3 a 30: letras, números, punto, guion o guion bajo" autoComplete="off" className={claseInput} />
          </Campo>
          <Campo id="email" etiqueta="Correo de trabajo" opcional error={errores.email}>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="off" className={claseInput} />
          </Campo>
          <SelectorRol valor={rol} onChange={setRol} id="nuevo" />
          {errores.rol && <p className="text-sm text-red-700">{errores.rol}</p>}
          {rol === 'ADMIN' && (
            <p className="rounded-xl bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-[#6b4a00]" role="note">
              Un administrador puede ver <strong>todos</strong> los reportes y dar de alta, editar o dar de baja a cualquier
              empleado, incluidos otros administradores. Dáselo solo a quien lo necesite.
            </p>
          )}
          <Campo id="password" etiqueta="Contraseña temporal" error={errores.passwordTemporal}>
            <div className="flex gap-2">
              <input id="password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={72} autoComplete="off" className={`${claseInput} cifras`} />
              <button type="button" onClick={() => setPassword(generarPasswordTemporal())} title="Generar otra"
                className="inline-flex items-center gap-1.5 h-12 px-3 rounded-xl text-sm font-semibold text-miaa-azul hover:bg-blue-50 shrink-0">
                <RefreshCw size={16} aria-hidden="true" /> Otra
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Mínimo 6 caracteres con letras y números. Se la das tú; la persona la cambia al entrar.</p>
          </Campo>

          <button type="submit" disabled={enviando || !cumplePolitica(password)}
            className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors">
            {enviando ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
            {enviando ? 'Dando de alta…' : rol === 'ADMIN' ? 'Dar de alta como administrador' : 'Dar de alta como notificador'}
          </button>
        </form>
      )}
    </div>
  );
}

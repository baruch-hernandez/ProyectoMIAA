import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LoaderCircle, LogOut } from 'lucide-react';
import { cuentaApi } from '../../services/cuentaApi';
import { leerError } from '../../services/reportesApi';
import type { Cuenta } from '../../types/reporte';
import { actualizarUsuario, cerrarSesion, obtenerToken, rutaInicio } from '../../utils/sesion';
import { Marca } from '../Marca';
import { AvisoPrivacidad } from './AvisoPrivacidad';
import { FormCambioPassword } from './FormCambioPassword';

/**
 * Antes de usar la app, la persona resuelve lo que le falte, en orden:
 *   1. cambiar la contraseña temporal que le dio el admin,
 *   2. aceptar el aviso de privacidad (solo notificadores).
 * El estado real lo dice el backend (GET /usuarios/yo), no lo guardado en el navegador.
 */
export function RequisitosCuenta() {
  const navigate = useNavigate();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obtenerToken()) return;
    let ignorar = false;
    cuentaApi
      .yo()
      .then((c) => { if (!ignorar) setCuenta(c); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); });
    return () => { ignorar = true; };
  }, []);

  // Cada vez que se resuelve un paso: si ya no falta nada, a su pantalla de inicio
  const alAvanzar = (c: Cuenta) => {
    actualizarUsuario({ debeCambiarPassword: c.debeCambiarPassword, avisoPrivacidadPendiente: c.avisoPrivacidadPendiente });
    if (!c.debeCambiarPassword && !c.avisoPrivacidadPendiente) {
      navigate(rutaInicio(c.rol), { replace: true });
    } else {
      setCuenta(c);
    }
  };

  // Llegó aquí sin requisitos (p. ej. con el botón Atrás): a su inicio
  useEffect(() => {
    if (cuenta && !cuenta.debeCambiarPassword && !cuenta.avisoPrivacidadPendiente) {
      actualizarUsuario({ debeCambiarPassword: false, avisoPrivacidadPendiente: false });
      navigate(rutaInicio(cuenta.rol), { replace: true });
    }
  }, [cuenta, navigate]);

  if (!obtenerToken()) return <Navigate to="/" replace />;

  const salir = () => {
    cerrarSesion();
    navigate('/', { replace: true });
  };

  const paso = cuenta?.debeCambiarPassword ? 'password' : cuenta?.avisoPrivacidadPendiente ? 'aviso' : null;
  const total = cuenta ? Number(cuenta.debeCambiarPassword) + Number(cuenta.avisoPrivacidadPendiente) : 0;

  return (
    <div className="min-h-dvh bg-miaa-fondo flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Marca />
          <button type="button" onClick={salir} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50">
            <LogOut size={18} aria-hidden="true" /> Salir
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-8">
        {error ? (
          <div className="p-5 rounded-2xl bg-white border border-slate-200">
            <p className="font-bold text-miaa-marino">No se pudo cargar tu cuenta.</p>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
          </div>
        ) : !cuenta || !paso ? (
          <div className="grid place-items-center py-16 text-slate-500" aria-busy="true">
            <LoaderCircle className="animate-spin" aria-label="Cargando" />
          </div>
        ) : (
          <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8">
            {total > 1 && (
              <p className="cifras text-xs font-bold text-miaa-azul">
                Paso {paso === 'password' ? 1 : 2} de {total}
              </p>
            )}
            {paso === 'password' ? (
              <>
                <h1 className="mt-1 text-2xl font-extrabold text-miaa-marino">Crea tu contraseña</h1>
                <p className="mt-1 mb-6 text-slate-600">
                  Hola, {cuenta.nombre.split(' ')[0]}. Entraste con una contraseña temporal; crea una nueva que solo tú conozcas.
                </p>
                <FormCambioPassword etiquetaActual="Contraseña temporal" onListo={alAvanzar} />
              </>
            ) : (
              <>
                <h1 className="mt-1 text-2xl font-extrabold text-miaa-marino">Aviso de privacidad</h1>
                <p className="mt-1 mb-5 text-slate-600">Antes de usar la aplicación, lee cómo se usan tus datos.</p>
                <AvisoPrivacidad onAceptado={alAvanzar} />
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

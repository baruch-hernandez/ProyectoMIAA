import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import { obtenerUsuario, rutaInicio } from '../../utils/sesion';
import { FormCambioPassword } from './FormCambioPassword';

/** Cambiar la contraseña por gusto (cualquier rol). Vive dentro del menú de cada rol. */
export function CambiarPassword() {
  const [listo, setListo] = useState(false);
  const inicio = rutaInicio(obtenerUsuario()?.rol);

  return (
    <div className="max-w-md">
      <Link to={inicio} className="inline-flex items-center gap-1.5 h-10 text-sm font-semibold text-miaa-azul hover:text-miaa-marino">
        <ArrowLeft size={18} aria-hidden="true" /> Regresar
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold text-miaa-marino">Cambiar contraseña</h1>

      <section className="mt-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
        {listo ? (
          <p className="flex items-start gap-2 text-[#0b6b58] font-medium" role="status">
            <CircleCheck size={20} className="shrink-0" aria-hidden="true" />
            Listo, tu contraseña se cambió. Úsala la próxima vez que inicies sesión.
          </p>
        ) : (
          <FormCambioPassword etiquetaActual="Contraseña actual" onListo={() => setListo(true)} />
        )}
      </section>
    </div>
  );
}

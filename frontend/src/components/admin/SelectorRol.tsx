import { ShieldCheck, Smartphone } from 'lucide-react';
import type { RolUsuario } from '../../utils/sesion';
import { ROLES } from '../../utils/roles';

interface Props {
  valor: RolUsuario;
  onChange: (rol: RolUsuario) => void;
  /** Para que nadie se cambie su propio rol */
  deshabilitado?: boolean;
  nota?: string;
  /** Prefijo de los id (hay un selector en el alta y otro en la ficha) */
  id?: string;
}

/** Tarjetas para elegir el rol (radio buttons accesibles con teclado). */
export function SelectorRol({ valor, onChange, deshabilitado = false, nota, id = 'rol' }: Props) {
  return (
    <fieldset disabled={deshabilitado} className="space-y-2">
      <legend className="block text-sm font-semibold text-miaa-marino mb-1.5">Rol</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ROLES.map((r) => {
          const Icono = r.clave === 'ADMIN' ? ShieldCheck : Smartphone;
          const elegido = valor === r.clave;
          return (
            <label
              key={r.clave}
              htmlFor={`${id}-${r.clave}`}
              className={`flex gap-3 rounded-xl border-2 p-3 transition-colors ${
                deshabilitado ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              } ${elegido ? 'border-miaa-marino bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <input
                id={`${id}-${r.clave}`}
                type="radio"
                name={`${id}-rol`}
                value={r.clave}
                checked={elegido}
                onChange={() => onChange(r.clave)}
                className="mt-1 size-4 accent-miaa-marino"
              />
              <span>
                <span className="flex items-center gap-1.5 font-bold text-miaa-marino">
                  <Icono size={16} aria-hidden="true" /> {r.nombre}
                </span>
                <span className="block text-xs text-slate-600">{r.descripcion}</span>
              </span>
            </label>
          );
        })}
      </div>
      {nota && <p className="text-xs text-slate-500">{nota}</p>}
    </fieldset>
  );
}

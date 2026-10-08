import type { EstadoQueja, PrioridadQueja } from '../../types/queja';
import { COLOR_ESTADO, COLOR_PRIORIDAD, ESTADOS, PRIORIDADES } from '../../utils/catalogos';

export function EstadoBadge({ estado }: { estado: EstadoQueja }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${COLOR_ESTADO[estado]}`}>
      {ESTADOS[estado]}
    </span>
  );
}

export function PrioridadBadge({ prioridad }: { prioridad: PrioridadQueja }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${COLOR_PRIORIDAD[prioridad]}`}>
      Prioridad {PRIORIDADES[prioridad].toLowerCase()}
    </span>
  );
}

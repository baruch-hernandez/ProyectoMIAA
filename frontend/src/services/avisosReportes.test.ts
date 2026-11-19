import { describe, expect, it, vi } from 'vitest';
import type { ReporteResumen } from '../types/reporte';
import { coincideConFiltros, leerEventos } from './avisosReportes';

// api.ts y la sesión leen sessionStorage del navegador al cargarse: aquí no hacen falta
vi.mock('./api', () => ({ URL_API: '' }));
vi.mock('../utils/sesion', () => ({ obtenerToken: () => null }));

describe('leerEventos (formato SSE)', () => {
  it('saca el evento con su nombre y sus datos, e ignora los comentarios (pings)', () => {
    const { eventos, resto } = leerEventos(':conectado\n\nevent:nuevo-reporte\ndata:{"id":7}\n\n:ping\n\n');
    expect(eventos).toEqual([{ nombre: 'nuevo-reporte', datos: '{"id":7}' }]);
    expect(resto).toBe('');
  });

  it('un evento partido en dos lecturas se arma con la siguiente', () => {
    const primera = leerEventos('event:nuevo-reporte\ndata:{"id"');
    expect(primera.eventos).toEqual([]);
    const segunda = leerEventos(primera.resto + ':8}\n\n');
    expect(segunda.eventos).toEqual([{ nombre: 'nuevo-reporte', datos: '{"id":8}' }]);
  });
});

describe('coincideConFiltros (qué se inserta en vivo en la bandeja)', () => {
  const r = { autorId: 5, fechaCreacion: '2026-11-19T15:04:00' } as ReporteResumen;

  it('respeta empleado y rango de días, como el backend', () => {
    expect(coincideConFiltros(r, { empleadoId: '', desde: '', hasta: '' })).toBe(true);
    expect(coincideConFiltros(r, { empleadoId: '5', desde: '2026-11-19', hasta: '2026-11-19' })).toBe(true);
    expect(coincideConFiltros(r, { empleadoId: '6', desde: '', hasta: '' })).toBe(false);
    expect(coincideConFiltros(r, { empleadoId: '', desde: '', hasta: '2026-11-18' })).toBe(false);
  });
});

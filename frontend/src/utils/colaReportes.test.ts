// La cola sin conexión decide si un reporte de campo se BORRA del navegador: que solo pase al llegar.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReporteRequest } from '../types/reporte';
import { enviarPendientes, guardarPendiente, listarPendientes } from './colaReportes';

const { crear } = vi.hoisted(() => ({ crear: vi.fn() }));

// El reportesApi real carga la sesión del navegador (sessionStorage): aquí solo hace falta lo que usa la cola
vi.mock('../services/reportesApi', () => ({
  reportesApi: { crear },
  esErrorDeRed: (e: unknown) => e instanceof AxiosError && !e.response,
  leerError: (e: unknown) => ({ mensaje: e instanceof AxiosError ? e.message : 'error', errores: {} }),
}));

const USUARIO = 7;

function http(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(`HTTP ${status}`, 'ERR', config, undefined, { status, statusText: '', headers: {}, config, data: {} });
}

async function encolar(clienteId: string, minuto: number) {
  await guardarPendiente({
    clienteId, usuarioId: USUARIO, intentos: 0,
    guardadoEn: `2026-11-19T10:0${minuto}:00Z`, datos: {} as ReporteRequest,
  });
}

describe('enviarPendientes', () => {
  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory(); // base vacía en cada prueba
    crear.mockReset();
    await encolar('a', 1);
    await encolar('b', 2);
  });

  it('borra de la cola solo los que el servidor recibió', async () => {
    crear.mockResolvedValue({});

    expect(await enviarPendientes(USUARIO)).toBe(2);
    expect(await listarPendientes(USUARIO)).toEqual([]);
  });

  it.each([
    ['sin red', new AxiosError('Network Error')],
    ['servidor caído (500)', http(500)],
    ['sesión vencida (401)', http(401)],
  ])('%s: no borra ni marca nada y deja de intentar', async (_, error) => {
    crear.mockRejectedValue(error);

    expect(await enviarPendientes(USUARIO)).toBe(0);
    expect(crear).toHaveBeenCalledTimes(1); // no sigue con "b"
    expect((await listarPendientes(USUARIO)).map((p) => [p.clienteId, p.error])).toEqual([['a', undefined], ['b', undefined]]);
  });

  it('si el servidor rechaza uno (400), lo marca, lo conserva y sigue con los demás', async () => {
    crear.mockRejectedValueOnce(http(400)).mockResolvedValueOnce({});

    expect(await enviarPendientes(USUARIO)).toBe(1);
    const [a] = await listarPendientes(USUARIO);
    expect(a).toMatchObject({ clienteId: 'a', error: 'HTTP 400', intentos: 1 });

    crear.mockClear();
    await enviarPendientes(USUARIO); // el rechazado ya no se reintenta solo
    expect(crear).not.toHaveBeenCalled();
  });
});

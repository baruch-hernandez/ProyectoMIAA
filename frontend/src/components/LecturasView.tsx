import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Ruta {
  id: number;
  codigoSector: string;
  zonaColonia: string;
  puntosTrazados?: number;
  estado: string;
}

export function LecturasView() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Estado para la ventana modal de captura
  const [rutaSeleccionada, setRutaSeleccionada] = useState<Ruta | null>(null);
  const [numeroMedidor, setNumeroMedidor] = useState('');
  const [lecturaAnterior, setLecturaAnterior] = useState('120'); // Ejemplo base
  const [lecturaActual, setLecturaActual] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  const navigate = useNavigate();
  const usuarioLocal = JSON.parse(localStorage.getItem('user') || '{}');
  const nombreOperador = usuarioLocal.nombre || 'Juan Pérez';
  const idLecturista = usuarioLocal.id || '2';

  useEffect(() => {
    cargarRutas();
  }, []);

  const cargarRutas = async () => {
    try {
      setCargando(true);
      const response = await axios.get(`http://localhost:8080/api/v1/rutas/lecturista/${idLecturista}`);
      setRutas(response.data);
    } catch (error) {
      console.error('Error al obtener rutas asignadas:', error);
    } finally {
      setCargando(false);
    }
  };

  const handleCerrarSesion = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const abrirModalCaptura = (ruta: Ruta) => {
    setRutaSeleccionada(ruta);
    setNumeroMedidor(`MED-${Math.floor(100000 + Math.random() * 900000)}`);
    setLecturaActual('');
    setObservaciones('');
    setMensajeExito('');
  };

  const handleGuardarLectura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturaActual || parseFloat(lecturaActual) < parseFloat(lecturaAnterior)) {
      alert('La lectura actual debe ser mayor o igual a la lectura anterior.');
      return;
    }

    try {
      setGuardando(true);
      const payload = {
        numeroMedidor,
        lecturaAnterior: parseFloat(lecturaAnterior),
        lecturaActual: parseFloat(lecturaActual),
        observaciones,
        ruta: { id: rutaSeleccionada?.id },
        usuario: { id: parseInt(idLecturista) }
      };

      await axios.post('http://localhost:8080/api/v1/lecturas', payload);

      // Actualizar el estado de la ruta a COMPLETADA si aplica
      if (rutaSeleccionada) {
        await axios.put(`http://localhost:8080/api/v1/rutas/${rutaSeleccionada.id}`, {
          estado: 'COMPLETADA'
        });
      }

      setMensajeExito('✅ Lectura capturada y guardada correctamente.');
      setTimeout(() => {
        setRutaSeleccionada(null);
        cargarRutas();
      }, 1500);

    } catch (error) {
      console.error('Error al guardar lectura:', error);
      alert('Ocurrió un error al guardar la lectura.');
    } finally {
      setGuardando(false);
    }
  };

  const consumoCalculado = Math.max(0, (parseFloat(lecturaActual) || 0) - parseFloat(lecturaAnterior));

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-6 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">MIAA - Captura de Lecturas</h1>
          <p className="text-sm text-gray-500">Operador: {nombreOperador}</p>
        </div>
        <button
          onClick={handleCerrarSesion}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
        >
          Salir
        </button>
      </div>

      {/* Listado de Rutas */}
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Rutas Asignadas</h2>

        {cargando ? (
          <p className="text-gray-500 text-sm">Cargando rutas asignadas...</p>
        ) : rutas.length === 0 ? (
          <p className="text-gray-500 text-sm">No tienes lecturas pendientes asignadas por el momento.</p>
        ) : (
          <div className="space-y-4">
            {rutas.map((ruta) => (
              <div key={ruta.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-blue-950">{ruta.codigoSector || 'SIN CÓDIGO'}</h3>
                  <p className="text-sm text-gray-600">Zona / Colonia: {ruta.zonaColonia || 'General'}</p>
                  <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    ruta.estado === 'COMPLETADA' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {ruta.estado}
                  </span>
                </div>
                <button 
                  onClick={() => abrirModalCaptura(ruta)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md font-medium"
                >
                  Capturar Lecturas
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Captura */}
      {rutaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-blue-900">
                Captura: {rutaSeleccionada.codigoSector}
              </h3>
              <button 
                onClick={() => setRutaSeleccionada(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {mensajeExito ? (
              <div className="p-4 bg-green-100 text-green-800 rounded-lg text-center font-semibold mb-4">
                {mensajeExito}
              </div>
            ) : (
              <form onSubmit={handleGuardarLectura} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Medidor</label>
                  <input
                    type="text"
                    value={numeroMedidor}
                    onChange={(e) => setNumeroMedidor(e.target.value)}
                    className="w-full border rounded-md p-2 bg-gray-50 text-gray-800"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lectura Anterior (m³)</label>
                    <input
                      type="number"
                      value={lecturaAnterior}
                      onChange={(e) => setLecturaAnterior(e.target.value)}
                      className="w-full border rounded-md p-2 bg-gray-100 text-gray-600"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lectura Actual (m³)</label>
                    <input
                      type="number"
                      value={lecturaActual}
                      onChange={(e) => setLecturaActual(e.target.value)}
                      placeholder="Ej. 145"
                      className="w-full border border-blue-400 rounded-md p-2 text-gray-800 focus:ring-2 focus:ring-blue-500"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-md border border-blue-200 text-sm text-blue-900 font-medium">
                  Consumo Registrado: <span className="font-bold text-base">{consumoCalculado} m³</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones / Incidencias</label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Sin fugas, medidor accesible, etc."
                    rows={3}
                    className="w-full border rounded-md p-2 text-gray-800 text-sm"
                  ></textarea>
                </div>

                <div className="flex justify-end space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setRutaSeleccionada(null)}
                    className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-100 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {guardando ? 'Guardando...' : 'Guardar Lectura'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
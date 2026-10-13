import React from 'react';

interface Props {
  onAceptar: () => void;
}

export const AvisoPrivacidadModal: React.FC<Props> = ({ onAceptar }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-bold text-blue-900 mb-2">Aviso de Privacidad - MIAA</h2>
        <div className="text-sm text-gray-600 h-40 overflow-y-auto mb-4 border p-2 rounded">
          <p className="mb-2">El Modelo Integral de Aguas de Aguascalientes (MIAA) utiliza sus datos de ubicación y fotografías capturadas únicamente para validar los reportes de campo e incidencias.</p>
          <p>Los datos se resguardarán en servidores institucionales conforme a las normativas de retención e información pública.</p>
        </div>
        <button
          onClick={onAceptar}
          className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 transition"
        >
          Aceptar y Continuar
        </button>
      </div>
    </div>
  );
};
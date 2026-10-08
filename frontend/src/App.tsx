import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { LecturasView } from './components/LecturasView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LecturistaLayout } from './components/lecturista/LecturistaLayout';
import { MisQuejas } from './components/lecturista/MisQuejas';
import { NuevaQueja } from './components/lecturista/NuevaQueja';
import { DetalleQueja } from './components/lecturista/DetalleQueja';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<Login />} />

        {/* Rutas protegidas solo para ADMIN */}
        <Route element={<ProtectedRoute allowedRole="ADMIN" />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* Rutas protegidas solo para LECTURISTA (el empleado de campo) */}
        <Route element={<ProtectedRoute allowedRole="LECTURISTA" />}>
          {/* Captura de lecturas (pantalla original, con su propio encabezado) */}
          <Route path="/lecturas" element={<LecturasView />} />

          {/* Quejas y notas de domicilios, dentro del menú del lecturista */}
          <Route element={<LecturistaLayout />}>
            <Route path="/mis-quejas" element={<MisQuejas />} />
            <Route path="/mis-quejas/nueva" element={<NuevaQueja />} />
            <Route path="/mis-quejas/:id" element={<DetalleQueja />} />
          </Route>
        </Route>

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

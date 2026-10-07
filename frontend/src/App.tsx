import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { LecturasView } from './components/LecturasView';
import { ProtectedRoute } from './components/ProtectedRoute';

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

        {/* Rutas protegidas solo para LECTURISTA */}
        <Route element={<ProtectedRoute allowedRole="LECTURISTA" />}>
          <Route path="/lecturas" element={<LecturasView />} />
        </Route>

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
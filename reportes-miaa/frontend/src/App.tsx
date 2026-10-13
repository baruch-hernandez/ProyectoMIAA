import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { ReportesAdmin } from './components/admin/ReportesAdmin';
import { EmpleadosAdmin } from './components/admin/EmpleadosAdmin';
import { LecturistaLayout } from './components/lecturista/LecturistaLayout';
import { MisReportes } from './components/lecturista/MisReportes';
import { NuevoReporte } from './components/lecturista/NuevoReporte';
import { DetalleReporte } from './components/reportes/DetalleReporte';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<Login />} />

        {/* ADMIN: solo consulta los reportes y el estado de los empleados */}
        <Route element={<ProtectedRoute allowedRole="ADMIN" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<ReportesAdmin />} />
            <Route path="/admin/reportes/:id" element={<DetalleReporte volverA={{ to: '/admin', texto: 'Reportes' }} />} />
            <Route path="/admin/empleados" element={<EmpleadosAdmin />} />
          </Route>
        </Route>

        {/* LECTURISTA (el empleado de campo): sube reportes y les da seguimiento */}
        <Route element={<ProtectedRoute allowedRole="LECTURISTA" />}>
          <Route element={<LecturistaLayout />}>
            <Route path="/reportes" element={<MisReportes />} />
            <Route path="/reportes/nuevo" element={<NuevoReporte />} />
            <Route path="/reportes/:id" element={<DetalleReporte volverA={{ to: '/reportes', texto: 'Mis reportes' }} />} />
          </Route>
        </Route>

        {/* Redirección por defecto (incluye las rutas viejas /mis-quejas, /lecturas...) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { ReportesAdmin } from './components/admin/ReportesAdmin';
import { EmpleadosAdmin } from './components/admin/EmpleadosAdmin';
import { UbicacionEmpleado } from './components/admin/UbicacionEmpleado';
import { NotificadorLayout } from './components/notificador/NotificadorLayout';
import { MisReportes } from './components/notificador/MisReportes';
import { NuevoReporte } from './components/notificador/NuevoReporte';
import { DetalleReporte } from './components/reportes/DetalleReporte';
import { EditarReporte } from './components/notificador/EditarReporte';
import { NuevoEmpleado } from './components/admin/NuevoEmpleado';
import { RequisitosCuenta } from './components/cuenta/RequisitosCuenta';
import { CambiarPassword } from './components/cuenta/CambiarPassword';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<Login />} />

        {/* Con sesión, pero ANTES de todo lo demás: contraseña temporal y aviso de privacidad */}
        <Route path="/cuenta/requisitos" element={<RequisitosCuenta />} />

        {/* ADMIN: solo consulta los reportes y el estado de los empleados */}
        <Route element={<ProtectedRoute allowedRole="ADMIN" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<ReportesAdmin />} />
            <Route path="/admin/reportes/:id" element={<DetalleReporte volverA={{ to: '/admin', texto: 'Reportes' }} />} />
            <Route path="/admin/empleados" element={<EmpleadosAdmin />} />
            <Route path="/admin/empleados/nuevo" element={<NuevoEmpleado />} />
            <Route path="/admin/empleados/:id" element={<UbicacionEmpleado />} />
            <Route path="/admin/password" element={<CambiarPassword />} />
          </Route>
        </Route>

        {/* NOTIFICADOR (el empleado de campo): sube reportes y les da seguimiento */}
        <Route element={<ProtectedRoute allowedRole="NOTIFICADOR" />}>
          <Route element={<NotificadorLayout />}>
            <Route path="/reportes" element={<MisReportes />} />
            <Route path="/reportes/nuevo" element={<NuevoReporte />} />
            <Route path="/reportes/:id" element={<DetalleReporte volverA={{ to: '/reportes', texto: 'Mis reportes' }} />} />
            <Route path="/reportes/:id/editar" element={<EditarReporte />} />
            <Route path="/cuenta/password" element={<CambiarPassword />} />
          </Route>
        </Route>

        {/* Redirección por defecto (incluye las rutas viejas /mis-quejas, /lecturas...) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

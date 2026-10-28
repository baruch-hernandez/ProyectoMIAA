/// Validaciones del domicilio y la descripción, iguales a ReporteRequestDTO del backend.
/// Las usan el formulario nuevo y el de corrección. Reciben el texto ya sin espacios a los lados.
library;

String? Function(String) obligatorio(String mensaje) => (v) => v.isEmpty ? mensaje : null;

String? codigoPostal(String v) =>
    RegExp(r'^20\d{3}$').hasMatch(v) ? null : 'Debe ser un C.P. de Aguascalientes (20xxx)';

String? descripcion(String v) => v.length < 10 ? 'Describe el reporte (mínimo 10 caracteres)' : null;

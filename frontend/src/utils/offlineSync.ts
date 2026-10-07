// Requerimiento: Guardado offline y sincronización posterior
export const guardarInformeLocal = (informe: any) => {
  const pendientes = JSON.parse(localStorage.getItem('informes_offline') || '[]');
  pendientes.push(informe);
  localStorage.setItem('informes_offline', JSON.stringify(pendientes));
};

export const sincronizarInformesOffline = async () => {
  const pendientes = JSON.parse(localStorage.getItem('informes_offline') || '[]');
  if (pendientes.length === 0) return;

  const noEnviados = [];
  for (const informe of pendientes) {
    try {
      await fetch('http://localhost:8080/api/v1/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(informe)
      });
    } catch {
      noEnviados.push(informe);
    }
  }

  localStorage.setItem('informes_offline', JSON.stringify(noEnviados));
  if (noEnviados.length === 0) {
    alert('✅ Informes guardados sin conexión han sido sincronizados con el servidor de MIAA.');
  }
};

window.addEventListener('online', sincronizarInformesOffline);
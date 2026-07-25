/**
 * Módulo Monitor - Atualiza o painel de sistema na sidebar
 */
const SystemMonitor = (() => {
  let lastData = null;

  function init() {
    window.api.onMonitorData((data) => {
      lastData = data;
      updateSidebar(data);
    });
  }

  function updateSidebar(data) {
    // CPU do ServerRunner
    const cpuEl = document.getElementById('sys-cpu-bar');
    const cpuValEl = document.getElementById('sys-cpu-value');
    if (cpuEl) cpuEl.style.width = `${Math.min(data.cpu, 100)}%`;
    if (cpuValEl) cpuValEl.textContent = `${data.cpu}%`;

    // RAM do ServerRunner (usada pelo app)
    const ramEl = document.getElementById('sys-ram-bar');
    const ramValEl = document.getElementById('sys-ram-value');
    if (ramEl) ramEl.style.width = `${Math.min(data.appRamPercent, 100)}%`;
    if (ramValEl) ramValEl.textContent = `${data.appRamFormatted} (${data.appRamPercent}%)`;

    // RAM total do sistema (referência)
    const sysRamEl = document.getElementById('sys-ram-total');
    if (sysRamEl) sysRamEl.textContent = `Sistema: ${data.ram.used}/${data.ram.total} GB`;

    // Rede removida (não é mais relevante para o app em si)
    const netEl = document.getElementById('sys-net-value');
    if (netEl) netEl.textContent = '-';
  }

  function getLastData() {
    return lastData;
  }

  return { init, getLastData };
})();

/**
 * Módulo Logs - Exibe logs gerais do sistema
 */
const LogsView = (() => {
  let logs = [];

  function init() {
    const clearBtn = document.getElementById('btn-clear-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearLogs);
    }

    // Carrega logs existentes
    window.api.getLogs().then((existingLogs) => {
      logs = existingLogs || [];
      render();
    });

    // Escuta novos logs
    window.api.onLogEntry((log) => {
      logs.push(log);
      // Mantém máximo de 500
      if (logs.length > 500) logs.shift();
      appendLog(log);
    });
  }

  function render() {
    const container = document.getElementById('logs-list');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="logs-empty">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M4 8h24M4 16h24M4 24h16" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Nenhum log até o momento</span>
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map((log) => createLogEntry(log)).join('');
    scrollToBottom();
  }

  function appendLog(log) {
    const container = document.getElementById('logs-list');
    if (!container) return;

    // Remove empty state se existir
    const empty = container.querySelector('.logs-empty');
    if (empty) container.innerHTML = '';

    const div = document.createElement('div');
    div.innerHTML = createLogEntry(log);
    container.appendChild(div.firstElementChild || div);
    scrollToBottom();
  }

  function createLogEntry(log) {
    const time = formatLogTime(log.timestamp);
    const badgeClass = log.type || 'info';
    const badgeLabel = (log.type || 'info').toUpperCase();

    return `
      <div class="log-entry">
        <span class="log-time">${time}</span>
        <span class="log-badge ${badgeClass}">${badgeLabel}</span>
        <span class="log-message">${escapeHtml(log.message)}</span>
      </div>
    `;
  }

  function formatLogTime(isoString) {
    if (!isoString) return '--:--:--';
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function scrollToBottom() {
    const container = document.getElementById('logs-container');
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  async function clearLogs() {
    await window.api.clearLogs();
    logs = [];
    render();
  }

  return { init };
})();

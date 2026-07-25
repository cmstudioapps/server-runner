/**
 * Módulo Dashboard - Gerencia os cards de servidores
 */
const Dashboard = (() => {
  let servers = [];
  let serverStats = {};
  let searchQuery = '';

  function init() {
    window.api.onServersLoaded((loadedServers) => {
      servers = loadedServers;
      render();
    });

    window.api.onServerStats((stats) => {
      serverStats = { ...serverStats, ...stats };
      updateStatsUI(stats);
    });

    window.api.onServerUpdate((updated) => {
      updateServerInList(updated);
    });

    // Barra de pesquisa
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        render();
      });

      // Atalho Ctrl+F / Cmd+F foca na pesquisa
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      });
    }
  }

  function render() {
    const grid = document.getElementById('cards-grid');
    const empty = document.getElementById('empty-state');

    if (!servers || servers.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    // Filtra por nome ou path
    const filtered = searchQuery
      ? servers.filter((s) =>
          s.name.toLowerCase().includes(searchQuery) ||
          (s.projectPath && s.projectPath.toLowerCase().includes(searchQuery)) ||
          (s.entryFile && s.entryFile.toLowerCase().includes(searchQuery))
        )
      : servers;

    empty.style.display = 'none';
    grid.style.display = 'grid';

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="search-empty">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="18" cy="18" r="12" stroke="#6B7280" stroke-width="2"/>
            <path d="M27 27l9 9" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>Nenhum servidor encontrado para "<strong>${escapeHtml(searchQuery)}</strong>"</p>
        </div>
      `;
      grid.style.display = 'block';
      return;
    }

    grid.innerHTML = filtered.map((s) => createCard(s)).join('');
    filtered.forEach((s) => attachCardEvents(s));
  }

  function createCard(server) {
    const color = stringToColor(server.name);
    const initials = getInitials(server.name);
    const isOnline = server.status === 'online';
    const portInfo = server.port ? `:${server.port}` : '';
    const stats = serverStats[server.id];
    const cpuVal = stats ? `${stats.cpu}%` : '-';
    const ramVal = stats ? stats.ramFormatted : '-';
    const uptimeVal = stats && isOnline ? formatUptime(stats.uptime) : (server.uptime || '-');
    const hasTunnel = !!server.publicUrl;

    const watchEnabled = server.watchEnabled;
    const ICONS = ['🚀','⚡','🔥','💻','🖥️','📡','🔧','⚙️','🛠️','📦','🐳','☁️','🌐','🔗','📊','🎯','💎','🧩','🎨','📁'];

    return `
      <div class="server-card" data-id="${server.id}" data-online="${isOnline}">
        <div class="server-card-header">
          <div class="server-icon clickable" data-action="pick-icon" data-id="${server.id}" title="Clique para mudar o ícone"
               style="background: rgba(${hexToRgb(color)}, 0.1); border-color: ${color}20; color: ${color}">
            ${server.icon || initials}
          </div>
          <div class="server-info-header">
            <div class="server-name">${escapeHtml(server.name)}</div>
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <span class="server-badge ${isOnline ? 'online' : 'offline'}">
                <span class="badge-dot"></span>
                ${isOnline ? 'Online' : 'Offline'}
              </span>
              <label class="watch-toggle" title="Reiniciar automaticamente ao alterar arquivos">
                <input type="checkbox" data-action="toggle-watch" data-id="${server.id}" ${watchEnabled ? 'checked' : ''} />
                <span class="watch-slider"></span>
                <span class="watch-label">Auto</span>
              </label>
            </div>
          </div>
        </div>

        <div class="server-info-list">
          <div class="server-info-item">
            <span class="info-label">Porta</span>
            <span class="info-value">${portInfo || '-'}</span>
          </div>
          <div class="server-info-item">
            <span class="info-label">Ativo há</span>
            <span class="info-value" id="uptime-${server.id}">${uptimeVal}</span>
          </div>
          <div class="server-info-item" style="grid-column: span 2">
            <span class="info-label">Local</span>
            <span class="info-value url" onclick="copyToClipboard('http://localhost${portInfo}')">
              http://localhost${portInfo}
            </span>
          </div>
          ${hasTunnel ? `
          <div class="server-info-item" style="grid-column: span 2">
            <span class="info-label">Pública</span>
            <span class="info-value url" onclick="copyToClipboard('${escapeHtml(server.publicUrl)}')">
              ${escapeHtml(server.publicUrl)}
            </span>
          </div>
          ` : ''}
          <div class="server-info-item">
            <span class="info-label">CPU</span>
            <span class="info-value mono" id="scpu-${server.id}">${cpuVal}</span>
          </div>
          <div class="server-info-item">
            <span class="info-label">RAM</span>
            <span class="info-value mono" id="sram-${server.id}">${ramVal}</span>
          </div>
          <div class="server-info-item" style="grid-column: span 2">
            <span class="info-label">Processos</span>
            <span class="info-value mono" id="sprocs-${server.id}">${stats && isOnline ? `${stats.processes} proc` : '-'}</span>
          </div>
        </div>

        <div class="server-actions">
          <button class="action-btn start" data-action="start" data-id="${server.id}" ${isOnline ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1l10 6-10 6V1z" fill="currentColor"/></svg>
            Start
          </button>
          <button class="action-btn stop" data-action="stop" data-id="${server.id}" ${!isOnline ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"/></svg>
            Stop
          </button>
          <button class="action-btn files-btn" data-action="files" data-id="${server.id}" title="Explorar arquivos do projeto">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5v7a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1H7L5.5 3.5H3a1 1 0 00-1 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="action-btn terminal-btn" data-action="terminal" data-id="${server.id}">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4l4 3-4 3M7 10h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="action-btn tunnel-btn ${hasTunnel ? 'active' : ''}" data-action="tunnel" data-id="${server.id}" title="${hasTunnel ? 'Desativar tunnel público' : 'Ativar tunnel público'}" ${!isOnline ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2a5 5 0 015 5M7 2a5 5 0 00-5 5M7 2v1M7 11v1M2 7h1M11 7h1M4.5 4.5l1 1M8.5 8.5l1 1M4.5 9.5l1-1M8.5 5.5l1-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.3"/>
            </svg>
          </button>
          <button class="action-btn delete-btn" data-action="delete" data-id="${server.id}" title="Remover do ServerRunner">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3h10M5 3V2a1 1 0 011-1h2a1 1 0 011 1v1M4 6v6h6V6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function attachCardEvents(server) {
    const card = document.querySelector(`.server-card[data-id="${server.id}"]`);
    if (!card) return;

    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (btn.disabled) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        // Desabilita o botão durante a ação sem perder o conteúdo
        btn.classList.add('loading');

        try {
          switch (action) {
            case 'start': {
              const current = getServerById(id);
              if (!current) throw new Error('Servidor não encontrado');
              const conflict = getPortConflict(current);
              if (conflict) {
                alert(`A porta ${current.port} já está em uso por "${conflict.name}". Pare esse projeto ou altere a porta antes de iniciar.`);
                break;
              }

              const exposeTunnel = await chooseStartMode(current);
              if (exposeTunnel === null) break;
              const updated = await window.api.startServer(id, { exposeTunnel });
              updateServerInList(updated);
              break;
            }
            case 'stop': {
              const updated = await window.api.stopServer(id);
              delete serverStats[id];
              updateServerInList(updated);
              break;
            }
            case 'tunnel': {
              const srv = getServerById(id);
              if (!srv) break;
              if (srv.publicUrl) {
                // Desativar tunnel
                const updated = await window.api.stopTunnel(id);
                updateServerInList(updated);
              } else {
                // Ativar tunnel
                const updated = await window.api.startTunnel(id);
                updateServerInList(updated);
              }
              break;
            }
            case 'files':
              await window.api.openFiles(id);
              break;

            case 'terminal':
              await window.api.openTerminal(id);
              break;

            case 'delete': {
              if (confirm(`Remover "${getServerById(id)?.name || id}" do ServerRunner?\n(O projeto no disco não será afetado.)`)) {
                await window.api.removeServer(id);
                removeServer(id);
              }
              break;
            }

            case 'pick-icon': {
              showIconPicker(id);
              break;
            }
          }
        } catch (err) {
          console.error(`Erro na ação ${action}:`, err);
          alert(err.message || `Erro na ação ${action}`);
        } finally {
          btn.classList.remove('loading');
        }
      });
    });

    // Watch toggle (checkbox dentro do card)
    card.querySelectorAll('[data-action="toggle-watch"]').forEach((cb) => {
      cb.addEventListener('change', async (e) => {
        e.stopPropagation();
        const id2 = cb.dataset.id;
        try {
          if (cb.checked) {
            const updated = await window.api.startWatcher(id2);
            updateServerInList(updated);
          } else {
            const updated = await window.api.stopWatcher(id2);
            updateServerInList(updated);
          }
        } catch (err) {
          console.error('Erro no toggle watch:', err);
          cb.checked = !cb.checked;
        }
      });
    });
  }

  // =================== ICON PICKER ===================
  const ICONS_LIST = ['🚀','⚡','🔥','💻','🖥️','📡','🔧','⚙️','🛠️','📦','🐳','☁️','🌐','🔗','📊','🎯','💎','🧩','🎨','📁','🛡️','⚓','🎮','🤖','🧠','📈','🔬','🪐','🌍','🧪'];

  function showIconPicker(serverId) {
    // Remove picker existente
    const old = document.getElementById('icon-picker-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'icon-picker-overlay';
    overlay.className = 'icon-picker-overlay';

    const grid = document.createElement('div');
    grid.className = 'icon-picker-grid';

    ICONS_LIST.forEach((ic) => {
      const btn = document.createElement('button');
      btn.className = 'icon-picker-btn';
      btn.textContent = ic;
      btn.addEventListener('click', async () => {
        await window.api.updateServerIcon(serverId, ic);
        const srv = getServerById(serverId);
        if (srv) updateServerInList({ ...srv, icon: ic });
        overlay.remove();
      });
      grid.appendChild(btn);
    });

    overlay.appendChild(grid);

    // Fecha ao clicar fora
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  /** Atualiza os valores de CPU/RAM/Uptime nos cards sem re-renderizar tudo */
  function updateStatsUI(statsMap) {
    for (const [id, stats] of Object.entries(statsMap)) {
      const cpuEl = document.getElementById(`scpu-${id}`);
      const ramEl = document.getElementById(`sram-${id}`);
      const uptimeEl = document.getElementById(`uptime-${id}`);
      const procsEl = document.getElementById(`sprocs-${id}`);

      if (cpuEl) cpuEl.textContent = `${stats.cpu}%`;
      if (ramEl) ramEl.textContent = stats.ramFormatted;
      if (procsEl) procsEl.textContent = `${stats.processes} proc`;
      if (uptimeEl) uptimeEl.textContent = formatUptime(stats.uptime);
    }
  }

  function updateServerInList(updated) {
    const idx = servers.findIndex((s) => s.id === updated.id);
    if (idx !== -1) servers[idx] = updated;
    render();
  }

  function addServer(server) {
    servers.push(server);
    render();
  }

  function removeServer(id) {
    servers = servers.filter((s) => s.id !== id);
    delete serverStats[id];
    render();
  }

  function getServerById(id) {
    return servers.find((s) => s.id === id);
  }

  function getPortConflict(server) {
    const port = Number(server?.port);
    if (!port) return null;
    return servers.find((s) =>
      s.id !== server.id &&
      s.status === 'online' &&
      Number(s.port) === port
    ) || null;
  }

  function chooseStartMode(server) {
    return new Promise((resolve) => {
      const old = document.getElementById('start-mode-overlay');
      if (old) old.remove();

      const overlay = document.createElement('div');
      overlay.id = 'start-mode-overlay';
      overlay.className = 'start-mode-overlay';
      overlay.innerHTML = `
        <div class="start-mode-dialog" role="dialog" aria-modal="true">
          <div class="start-mode-header">
            <span>Iniciar servidor</span>
            <button class="start-mode-close" type="button" aria-label="Fechar">×</button>
          </div>
          <div class="start-mode-body">
            <strong>${escapeHtml(server.name)}</strong>
            <p>Escolha como esse projeto deve ficar acessível.</p>
            <div class="start-mode-options">
              <button class="start-mode-option" type="button" data-mode="local">
                <span class="start-mode-icon">⌂</span>
                <span>
                  <b>Só localhost</b>
                  <small>Disponível apenas em http://localhost:${escapeHtml(String(server.port || ''))}</small>
                </span>
              </button>
              <button class="start-mode-option highlight" type="button" data-mode="tunnel">
                <span class="start-mode-icon">↗</span>
                <span>
                  <b>Expor via tunnel</b>
                  <small>Inicia local e cria uma URL pública pelo localtunnel.</small>
                </span>
              </button>
            </div>
          </div>
        </div>
      `;

      const finish = (value) => {
        overlay.remove();
        resolve(value);
      };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(null);
      });
      overlay.querySelector('.start-mode-close').addEventListener('click', () => finish(null));
      overlay.querySelector('[data-mode="local"]').addEventListener('click', () => finish(false));
      overlay.querySelector('[data-mode="tunnel"]').addEventListener('click', () => finish(true));

      document.body.appendChild(overlay);
    });
  }

  function getServers() {
    return servers;
  }

  // Utilitários
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? `${parseInt(m[1],16)}, ${parseInt(m[2],16)}, ${parseInt(m[3],16)}` : '94,242,255';
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return { init, render, addServer, removeServer, getServers };
})();

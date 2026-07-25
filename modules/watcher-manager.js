const chokidar = require('chokidar');
const ServerManager = require('./server-manager');
const LogManager = require('./log-manager');

// Map: serverId -> { watcher, debounceTimer }
const watchers = new Map();
const RESTART_DEBOUNCE_MS = 2000;

/**
 * Inicia monitoramento de uma pasta para auto-restart
 */
function startWatching(serverId, folderPath) {
  // Se já está monitorando, não duplica
  if (watchers.has(serverId)) return;

  try {
    const watcher = chokidar.watch(folderPath, {
      ignored: /(^|[\/\\])(node_modules|\.git|__pycache__|\.next|dist|build|\.cache|\.vscode)/i,
      persistent: true,
      ignoreInitial: true,
      depth: 5,
      interval: 1000,
    });

    let debounceTimer = null;

    watcher.on('change', (filePath) => {
      if (!ServerManager.isRunning(serverId)) return;

      // Debounce para não reiniciar múltiplas vezes seguidas
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const file = filePath.split(/[\\/]/).pop();
        LogManager.info(`Alteração detectada: ${file}`, { serverId, file });

        try {
          await ServerManager.stop(serverId);
          const server = require('./storage-manager').getServer(serverId);
          if (server) {
            await ServerManager.start(serverId, {
              command: server.startCommand,
              cwd: server.projectPath,
            });
            LogManager.success(`Auto-restart: "${server.name}" reiniciado`, { serverId });
          }
        } catch (err) {
          LogManager.error(`Erro no auto-restart: ${err.message}`, { serverId });
        }
      }, RESTART_DEBOUNCE_MS);
    });

    watcher.on('error', (err) => {
      console.error(`Erro no watcher ${serverId}:`, err);
    });

    watchers.set(serverId, { watcher, debounceTimer: null });
    LogManager.info(`Monitoramento de arquivos ativado`, { serverId });
  } catch (err) {
    console.error(`Erro ao iniciar watcher para ${serverId}:`, err);
  }
}

/**
 * Para monitoramento de uma pasta
 */
function stopWatching(serverId) {
  const entry = watchers.get(serverId);
  if (!entry) return;

  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  entry.watcher.close();
  watchers.delete(serverId);
  LogManager.info(`Monitoramento de arquivos desativado`, { serverId });
}

/**
 * Para todos os watchers
 */
function stopAll() {
  for (const id of watchers.keys()) {
    stopWatching(id);
  }
}

function isWatching(serverId) {
  return watchers.has(serverId);
}

module.exports = {
  startWatching,
  stopWatching,
  stopAll,
  isWatching,
};

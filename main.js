const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Módulos do main process
const ServerManager = require('./modules/server-manager');
const TerminalManager = require('./modules/terminal-manager');
const MonitorManager = require('./modules/monitor-manager');
const TunnelManager = require('./modules/tunnel-manager');
const StorageManager = require('./modules/storage-manager');
const LogManager = require('./modules/log-manager');
const WatcherManager = require('./modules/watcher-manager');

let mainWindow = null;
let splashWindow = null;
let terminalWindows = new Map();
let fileWindows = new Map();
let terminalDataListeners = new Map();
let serverStatusListeners = new Map();
let statsInterval = null;

const FILE_TREE_IGNORES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  'coverage',
]);
const MAX_FILE_TREE_ITEMS = 2500;
const MAX_EDIT_FILE_SIZE = 2 * 1024 * 1024;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 340,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'src', 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0B0D0F',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (process.env.ELECTRON_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    if (splashWindow && !splashWindow.isDestroyed()) {
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      }, 250);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function broadcastToRenderers(channel, data) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send(channel, data);
    }
  });
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    return process.kill(pid, 0);
  } catch {
    return false;
  }
}

function findPortConflict(server) {
  const port = Number(server?.port);
  if (!port) return null;

  return StorageManager.getAllServers().find((candidate) => (
    candidate.id !== server.id &&
    Number(candidate.port) === port &&
    candidate.status === 'online'
  )) || null;
}

function ensureServerStatusListener(id) {
  if (serverStatusListeners.has(id)) return;

  const listener = (status) => {
    const current = StorageManager.getServer(id);
    if (!current) return;

    if (status === 'offline') {
      TunnelManager.stopTunnel(id);
    }

    const fields = {
      status,
      publicUrl: status === 'offline' ? null : current.publicUrl,
    };

    if (status === 'online') {
      fields.pid = ServerManager.getPid(id);
      fields.startedAt = ServerManager.getStartTime(id) || current.startedAt || Date.now();
    } else {
      fields.pid = null;
      fields.startedAt = null;
      fields.uptime = null;
    }

    const updated = StorageManager.updateServer(id, fields) || current;

    broadcastToRenderers('server:update', updated);
  };

  serverStatusListeners.set(id, listener);
  ServerManager.onStatus(id, listener);
}

app.whenReady().then(async () => {
  createSplashWindow();
  await StorageManager.init();
  MonitorManager.init(process.pid);

  for (const server of StorageManager.getAllServers()) {
    if (server.status !== 'online') continue;

    if (server.pid && isPidAlive(server.pid)) {
      ServerManager.attach(server.id, {
        pid: server.pid,
        startTime: server.startedAt || Date.now(),
      });
      ensureServerStatusListener(server.id);
      continue;
    }

    StorageManager.updateServer(server.id, {
      status: 'offline',
      pid: null,
      startedAt: null,
      publicUrl: null,
      uptime: null,
    });
  }

  createMainWindow();

  const servers = StorageManager.getAllServers();
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('servers:loaded', servers);
  });

  // Inicia intervalo de stats por servidor
  startServerStatsInterval();

  // Escuta logs e retransmite para o renderer
  LogManager.onLog((log) => {
    broadcastToRenderers('log:entry', log);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  stopServerStatsInterval();
  MonitorManager.stop();
  TerminalManager.killAll();
  if (process.platform !== 'darwin') app.quit();
});

// ===================== Server Stats Interval =====================

function startServerStatsInterval() {
  if (statsInterval) return;

  statsInterval = setInterval(async () => {
    const pids = ServerManager.getAllPids();
    if (pids.length === 0) return;

    const results = {};
    for (const { id, pid } of pids) {
      const stats = await MonitorManager.getProcessStats(pid);
      if (stats) {
        const startTime = ServerManager.getStartTime(id);
        results[id] = {
          ...stats,
          uptime: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
        };
      }
    }

    if (Object.keys(results).length > 0) {
      broadcastToRenderers('server:stats', results);
    }
  }, 3000);
}

function stopServerStatsInterval() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}

// ===================== IPC Handlers =====================

// --- Selecionar pasta ---
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// --- Selecionar arquivo de mídia (imagem/vídeo para fundo) ---
ipcMain.handle('dialog:selectMedia', async (_, type) => {
  const filters = type === 'video'
    ? [{ name: 'Vídeos', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }]
    : [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters,
  });
  if (result.canceled) return null;
  // Converte o caminho do sistema para URL file:// válida (codifica espaços, acentos, etc)
  return require('url').pathToFileURL(result.filePaths[0]).href;
});

// --- Detectar configuração do projeto ---
ipcMain.handle('dialog:detectProject', async (_, folderPath) => {
  if (!folderPath) return null;
  const fs = require('fs');
  const path = require('path');

  const detection = {
    entryFile: null,
    startCommand: null,
    port: 3000,
    type: 'generic',
  };

  try {
    const files = fs.readdirSync(folderPath);

    // 1. Detecta Node.js (package.json)
    if (files.includes('package.json')) {
      detection.type = 'node';
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json'), 'utf-8'));

        // Tenta extrair comando start dos scripts
        if (pkg.scripts) {
          if (pkg.scripts.dev) detection.startCommand = 'npm run dev';
          else if (pkg.scripts.start) detection.startCommand = 'npm start';
          else if (pkg.scripts.serve) detection.startCommand = 'npm run serve';
        }

        // Tenta extrair porta de express/next/vite
        if (pkg.dependencies || pkg.devDependencies) {
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          if (deps.next) detection.port = 3000;
          else if (deps.vite) detection.port = 5173;
          else if (deps['@angular/core']) detection.port = 4200;
          else if (deps.react) {
            const hasVite = deps.vite || (pkg.scripts?.dev && pkg.scripts.dev.includes('vite'));
            detection.port = hasVite ? 5173 : 3000;
          }
        }

        // Procura entry file no package.json
        if (pkg.main) {
          const mainPath = path.join(folderPath, pkg.main);
          if (fs.existsSync(mainPath)) {
            detection.entryFile = pkg.main;
          }
        }
      } catch {}
    }

    // 2. Detecta Python
    if (files.some((f) => f === 'requirements.txt' || f === 'Pipfile' || f === 'pyproject.toml')) {
      detection.type = 'python';

      // Procura entry files python comuns
      for (const name of ['app.py', 'main.py', 'server.py', 'run.py', 'manage.py', 'api.py']) {
        if (files.includes(name)) {
          detection.entryFile = name;
          detection.startCommand = `python ${name}`;
          detection.port = 5000;
          break;
        }
      }
    }

    // 3. Detecta entrada por nomes comuns (fallback)
    if (!detection.entryFile) {
      const commonEntries = ['index.js', 'server.js', 'app.js', 'main.js', 'index.ts', 'server.ts', 'app.ts', 'main.ts'];
      for (const name of commonEntries) {
        if (files.includes(name)) {
          detection.entryFile = name;
          if (!detection.startCommand) {
            detection.startCommand = name.endsWith('.ts') ? `ts-node ${name}` : `node ${name}`;
          }
          break;
        }
      }
    }

    // Se tem entryFile mas não tem comando, monta um
    if (detection.entryFile && !detection.startCommand) {
      detection.startCommand = detection.entryFile.endsWith('.ts')
        ? `ts-node ${detection.entryFile}`
        : `node ${detection.entryFile}`;
    }

    // Comando fallback
    if (!detection.startCommand) {
      if (files.includes('package.json')) {
        detection.startCommand = 'npm start';
      } else if (detection.entryFile) {
        detection.startCommand = `node ${detection.entryFile}`;
      } else {
        detection.startCommand = 'npm start';
      }
    }

    return detection;
  } catch (err) {
    console.error('Erro ao detectar projeto:', err);
    return {
      entryFile: null,
      startCommand: 'npm start',
      port: 3000,
      type: 'generic',
    };
  }
});

// --- Servers CRUD ---
ipcMain.handle('server:add', async (_, config) => {
  const server = StorageManager.addServer(config);
  return server;
});

ipcMain.handle('server:remove', async (_, id) => {
  await ServerManager.stop(id);
  TunnelManager.stopTunnel(id);
  TerminalManager.disconnect(id);
  const statusListener = serverStatusListeners.get(id);
  if (statusListener) {
    ServerManager.offStatus(id, statusListener);
    serverStatusListeners.delete(id);
  }
  StorageManager.removeServer(id);
});

ipcMain.handle('server:list', () => {
  return StorageManager.getAllServers();
});

ipcMain.handle('server:get', async (_, id) => {
  return StorageManager.getServer(id);
});

// --- Server Actions ---
ipcMain.handle('server:start', async (_, id, options = {}) => {
  const server = StorageManager.getServer(id);
  if (!server) throw new Error('Servidor não encontrado');

  const conflict = findPortConflict(server);
  if (conflict) {
    throw new Error(`A porta ${server.port} já está em uso por "${conflict.name}". Pare esse projeto ou mude a porta antes de iniciar.`);
  }

  ensureServerStatusListener(id);
  await ServerManager.start(id, {
    command: server.startCommand,
    cwd: server.projectPath,
  });

  const pid = ServerManager.getPid(id);
  let updated = StorageManager.updateServer(id, {
    status: 'online',
    pid,
    startedAt: ServerManager.getStartTime(id) || Date.now(),
  });

  if (options.exposeTunnel) {
    try {
      const url = await TunnelManager.startTunnel(id, server.port);
      updated = StorageManager.updateServer(id, { publicUrl: url }) || updated;
      LogManager.info(`Tunnel ativo para "${server.name}"`, { serverId: id, url });
    } catch (err) {
      LogManager.error(`Falha ao criar tunnel para "${server.name}": ${err.message}`, { serverId: id });
      throw err;
    }
  }

  if (updated) broadcastToRenderers('server:update', updated);

  LogManager.success(`Servidor "${server.name}" iniciado`, { serverId: id, port: server.port });
  return StorageManager.getServer(id);
});

ipcMain.handle('server:stop', async (_, id) => {
  const server = StorageManager.getServer(id);
  if (!server) throw new Error('Servidor não encontrado');

  ensureServerStatusListener(id);
  await ServerManager.stop(id);
  StorageManager.updateServer(id, {
    status: 'offline',
    pid: null,
    startedAt: null,
    publicUrl: null,
    uptime: null,
  });
  LogManager.info(`Servidor "${server.name}" parado`, { serverId: id });
  return StorageManager.getServer(id);
});

ipcMain.handle('server:restart', async (_, id) => {
  const server = StorageManager.getServer(id);
  if (!server) throw new Error('Servidor não encontrado');

  const conflict = findPortConflict(server);
  if (conflict) {
    throw new Error(`A porta ${server.port} já está em uso por "${conflict.name}". Pare esse projeto ou mude a porta antes de reiniciar.`);
  }

  ensureServerStatusListener(id);
  await ServerManager.stop(id);
  await ServerManager.start(id, {
    command: server.startCommand,
    cwd: server.projectPath,
  });

  const pid = ServerManager.getPid(id);
  StorageManager.updateServer(id, {
    status: 'online',
    pid,
    startedAt: ServerManager.getStartTime(id) || Date.now(),
  });

  LogManager.info(`Servidor "${server.name}" reiniciado`, { serverId: id });
  return StorageManager.getServer(id);
});

// --- Per-server stats ---
ipcMain.handle('server:stats', async (_, id) => {
  const pid = ServerManager.getPid(id);
  if (!pid) return null;
  const stats = await MonitorManager.getProcessStats(pid);
  if (stats) {
    const startTime = ServerManager.getStartTime(id);
    stats.uptime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  }
  return stats;
});

// --- Terminal ---
ipcMain.handle('terminal:open', async (_, serverId) => {
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const existing = terminalWindows.get(serverId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    existing.webContents.focus();
    return;
  }

  const termWin = createTerminalWindow(serverId, server.name);
  const attachTerminalData = () => {
    const prev = terminalDataListeners.get(serverId);
    if (prev) {
      TerminalManager.offData(serverId, prev);
      terminalDataListeners.delete(serverId);
    }

    const listener = (data) => {
      const win = terminalWindows.get(serverId);
      if (win && !win.isDestroyed()) {
        win.webContents.send('terminal:data', data);
      }
    };

    terminalDataListeners.set(serverId, listener);
    TerminalManager.onData(serverId, listener);
  };

  termWin.webContents.on('did-finish-load', () => {
    // A janela precisa ouvir antes do TerminalManager reenviar o buffer do servidor.
    attachTerminalData();

    // Cria o shell interativo no diretório do projeto
    TerminalManager.create(serverId, { cwd: server.projectPath });
  });
});

ipcMain.handle('terminal:write', (_, { serverId, input }) => {
  TerminalManager.write(serverId, input);
});

ipcMain.handle('terminal:close', (_, serverId) => {
  TerminalManager.kill(serverId);
  const listener = terminalDataListeners.get(serverId);
  if (listener) {
    TerminalManager.offData(serverId, listener);
    terminalDataListeners.delete(serverId);
  }
  const termWin = terminalWindows.get(serverId);
  if (termWin && !termWin.isDestroyed()) termWin.close();
  terminalWindows.delete(serverId);
});

ipcMain.handle('terminal:resize', (_, { serverId, cols, rows }) => {
  TerminalManager.resize(serverId, cols, rows);
});

ipcMain.handle('terminal:status', (_, serverId) => {
  return ServerManager.isRunning(serverId) ? 'online' : 'offline';
});

// --- Project Files ---
function getProjectRoot(server) {
  const fs = require('fs');
  return fs.realpathSync(server.projectPath);
}

function safeProjectPath(server, relativePath = '') {
  const fs = require('fs');
  let root;
  try {
    root = fs.realpathSync(server.projectPath);
  } catch {
    root = path.resolve(server.projectPath);
  }
  const target = path.resolve(root, relativePath || '.');
  let realTarget;
  try {
    realTarget = fs.existsSync(target) ? fs.realpathSync(target) : path.resolve(target);
  } catch {
    realTarget = target;
  }
  const rel = path.relative(root, realTarget);

  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Caminho fora da pasta do projeto.');
  }

  return { root, target: realTarget };
}

function toProjectRelative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function buildProjectTree(root, current, state) {
  const fs = require('fs');
  if (state.count >= MAX_FILE_TREE_ITEMS) return null;

  const name = path.basename(current);
  const stat = fs.statSync(current);
  const relativePath = toProjectRelative(root, current);

  if (stat.isDirectory()) {
    if (relativePath && FILE_TREE_IGNORES.has(name)) return null;

    const entries = fs.readdirSync(current, { withFileTypes: true })
      .filter((entry) => !FILE_TREE_IGNORES.has(entry.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    state.count += 1;
    return {
      name: relativePath ? name : path.basename(root),
      path: relativePath,
      type: 'directory',
      children: entries.map((entry) => buildProjectTree(root, path.join(current, entry.name), state)).filter(Boolean),
    };
  }

  state.count += 1;
  return {
    name,
    path: relativePath,
    type: 'file',
    size: stat.size,
  };
}

ipcMain.handle('files:open', async (_, serverId) => {
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const existing = fileWindows.get(serverId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    existing.webContents.focus();
    return;
  }

  const fileWin = createFileWindow(serverId, server.name);
  fileWindows.set(serverId, fileWin);
});

ipcMain.handle('files:list', async (_, serverId) => {
  // Retorna só o primeiro nível (raiz) — carregamento lazy
  const fs = require('fs');
  const path = require('path');
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');
  if (!fs.existsSync(server.projectPath)) throw new Error('Pasta do projeto não encontrada.');

  const { root } = safeProjectPath(server);
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => !FILE_TREE_IGNORES.has(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const children = entries.map((entry) => {
    const relPath = toProjectRelative(root, path.join(root, entry.name));
    if (entry.isDirectory()) {
      return { name: entry.name, path: relPath, type: 'directory', children: [] };
    }
    const stat = fs.statSync(path.join(root, entry.name));
    return { name: entry.name, path: relPath, type: 'file', size: stat.size };
  });

  return {
    root: server.projectPath,
    tree: { name: path.basename(root), path: '', type: 'directory', children },
  };
});

ipcMain.handle('files:listDir', async (_, { serverId, dirPath }) => {
  // Lista apenas os itens DENTRO de um diretório específico
  const fs = require('fs');
  const path = require('path');
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');
  if (!fs.existsSync(server.projectPath)) throw new Error('Pasta do projeto não encontrada.');

  const { root, target } = safeProjectPath(server, dirPath);
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) throw new Error('Não é um diretório.');

  const entries = fs.readdirSync(target, { withFileTypes: true })
    .filter((entry) => !FILE_TREE_IGNORES.has(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const children = entries.map((entry) => {
    const relPath = toProjectRelative(root, path.join(target, entry.name));
    if (entry.isDirectory()) {
      return { name: entry.name, path: relPath, type: 'directory', children: [] };
    }
    const st = fs.statSync(path.join(target, entry.name));
    return { name: entry.name, path: relPath, type: 'file', size: st.size };
  });

  return children;
});

ipcMain.handle('files:read', async (_, { serverId, filePath }) => {
  const fs = require('fs');
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const { target } = safeProjectPath(server, filePath);
  const stat = fs.statSync(target);
  if (!stat.isFile()) throw new Error('Selecione um arquivo para editar.');
  if (stat.size > MAX_EDIT_FILE_SIZE) {
    throw new Error('Arquivo muito grande para o editor interno.');
  }

  const content = fs.readFileSync(target, 'utf8');
  if (content.includes('\u0000')) {
    throw new Error('Arquivo binário não pode ser editado aqui.');
  }

  return {
    path: filePath,
    name: path.basename(target),
    content,
    size: stat.size,
    modifiedAt: stat.mtimeMs,
  };
});

ipcMain.handle('files:write', async (_, { serverId, filePath, content }) => {
  const fs = require('fs');
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const { target } = safeProjectPath(server, filePath);
  const stat = fs.statSync(target);
  if (!stat.isFile()) throw new Error('Selecione um arquivo para salvar.');
  if (Buffer.byteLength(content || '', 'utf8') > MAX_EDIT_FILE_SIZE) {
    throw new Error('Arquivo muito grande para salvar pelo editor interno.');
  }

  fs.writeFileSync(target, content || '', 'utf8');
  const updated = fs.statSync(target);
  return {
    path: filePath,
    size: updated.size,
    modifiedAt: updated.mtimeMs,
  };
});

// --- Monitoramento ---
ipcMain.handle('monitor:start', () => {
  MonitorManager.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('monitor:data', data);
    }
  });
});

ipcMain.handle('monitor:stop', () => {
  MonitorManager.stop();
});

// --- Watcher (auto-restart) ---
ipcMain.handle('watcher:start', (_, serverId) => {
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');
  WatcherManager.startWatching(serverId, server.projectPath);
  StorageManager.updateServer(serverId, { watchEnabled: true });
  return StorageManager.getServer(serverId);
});

ipcMain.handle('watcher:stop', (_, serverId) => {
  WatcherManager.stopWatching(serverId);
  StorageManager.updateServer(serverId, { watchEnabled: false });
  return StorageManager.getServer(serverId);
});

ipcMain.handle('watcher:status', (_, serverId) => {
  return WatcherManager.isWatching(serverId);
});

// --- Icon picker ---
ipcMain.handle('server:updateIcon', (_, { id, icon }) => {
  StorageManager.updateServer(id, { icon });
  return StorageManager.getServer(id);
});

// --- Logs ---
ipcMain.handle('log:getAll', () => {
  return LogManager.getAll();
});

ipcMain.handle('log:clear', () => {
  LogManager.clear();
});

// --- LocalTunnel ---
ipcMain.handle('tunnel:start', async (_, serverId) => {
  const server = StorageManager.getServer(serverId);
  if (!server) throw new Error('Servidor não encontrado');

  const url = await TunnelManager.startTunnel(serverId, server.port);
  const updated = StorageManager.updateServer(serverId, { publicUrl: url });
  if (updated) broadcastToRenderers('server:update', updated);
  LogManager.info(`Tunnel ativo para "${server.name}"`, { serverId, url });
  return StorageManager.getServer(serverId);
});

ipcMain.handle('tunnel:stop', async (_, serverId) => {
  const server = StorageManager.getServer(serverId);
  TunnelManager.stopTunnel(serverId);
  const updated = StorageManager.updateServer(serverId, { publicUrl: null });
  if (updated) broadcastToRenderers('server:update', updated);
  if (server) LogManager.info(`Tunnel desativado para "${server.name}"`, { serverId });
  return StorageManager.getServer(serverId);
});

// --- Window Controls ---
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

// Minimizar janela de arquivos
ipcMain.on('files:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('files:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// ===================== Terminal Window =====================

function createTerminalWindow(serverId, serverName) {
  const termWin = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    backgroundColor: '#0B0D0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  termWin.loadFile(path.join(__dirname, 'src', 'terminal.html'), {
    query: { serverId, name: serverName },
  });

  termWin.on('closed', () => {
    terminalWindows.delete(serverId);
  });

  terminalWindows.set(serverId, termWin);
  return termWin;
}

function createFileWindow(serverId, serverName) {
  const fileWin = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 900,
    minHeight: 560,
    frame: false,
    backgroundColor: '#0B0D0F',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  fileWin.loadFile(path.join(__dirname, 'src', 'files.html'), {
    query: { serverId, name: serverName },
  });

  fileWin.on('closed', () => {
    fileWindows.delete(serverId);
  });

  return fileWin;
}

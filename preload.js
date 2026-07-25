const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Selecionar pasta
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectMedia: (type) => ipcRenderer.invoke('dialog:selectMedia', type),
  detectProject: (folderPath) => ipcRenderer.invoke('dialog:detectProject', folderPath),

  // Servers CRUD
  addServer: (config) => ipcRenderer.invoke('server:add', config),
  removeServer: (id) => ipcRenderer.invoke('server:remove', id),
  listServers: () => ipcRenderer.invoke('server:list'),
  getServer: (id) => ipcRenderer.invoke('server:get', id),

  // Server Actions
  startServer: (id, options) => ipcRenderer.invoke('server:start', id, options),
  stopServer: (id) => ipcRenderer.invoke('server:stop', id),
  restartServer: (id) => ipcRenderer.invoke('server:restart', id),

  // Per-server stats
  getServerStats: (id) => ipcRenderer.invoke('server:stats', id),

  // Terminal
  openTerminal: (serverId) => ipcRenderer.invoke('terminal:open', serverId),
  writeTerminal: (serverId, input) =>
    ipcRenderer.invoke('terminal:write', { serverId, input }),
  resizeTerminal: (serverId, cols, rows) =>
    ipcRenderer.invoke('terminal:resize', { serverId, cols, rows }),
  closeTerminal: (serverId) => ipcRenderer.invoke('terminal:close', serverId),
  terminalStatus: (serverId) => ipcRenderer.invoke('terminal:status', serverId),

  // Monitor (system-wide)
  startMonitor: () => ipcRenderer.invoke('monitor:start'),
  stopMonitor: () => ipcRenderer.invoke('monitor:stop'),

  // Logs
  getLogs: () => ipcRenderer.invoke('log:getAll'),
  clearLogs: () => ipcRenderer.invoke('log:clear'),

  // Watcher (auto-restart)
  startWatcher: (serverId) => ipcRenderer.invoke('watcher:start', serverId),
  stopWatcher: (serverId) => ipcRenderer.invoke('watcher:stop', serverId),
  watcherStatus: (serverId) => ipcRenderer.invoke('watcher:status', serverId),

  // Icon
  updateServerIcon: (id, icon) => ipcRenderer.invoke('server:updateIcon', { id, icon }),

  // Tunnel
  startTunnel: (serverId) => ipcRenderer.invoke('tunnel:start', serverId),
  stopTunnel: (serverId) => ipcRenderer.invoke('tunnel:stop', serverId),

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  minimizeFileWindow: () => ipcRenderer.send('files:minimize'),
  closeFileWindow: () => ipcRenderer.send('files:close'),

  // Files (explorador/editor de código)
  openFiles: (serverId) => ipcRenderer.invoke('files:open', serverId),
  listFiles: (serverId) => ipcRenderer.invoke('files:list', serverId),
  listDir: (serverId, dirPath) => ipcRenderer.invoke('files:listDir', { serverId, dirPath }),
  readFile: (serverId, filePath) => ipcRenderer.invoke('files:read', { serverId, filePath }),
  writeFile: (serverId, filePath, content) => ipcRenderer.invoke('files:write', { serverId, filePath, content }),

  // Listeners
  onServersLoaded: (callback) =>
    ipcRenderer.on('servers:loaded', (_, servers) => callback(servers)),
  onMonitorData: (callback) =>
    ipcRenderer.on('monitor:data', (_, data) => callback(data)),
  onTerminalData: (callback) =>
    ipcRenderer.on('terminal:data', (_, data) => callback(data)),
  onServerStats: (callback) =>
    ipcRenderer.on('server:stats', (_, data) => callback(data)),
  onServerUpdate: (callback) =>
    ipcRenderer.on('server:update', (_, data) => callback(data)),
  onLogEntry: (callback) =>
    ipcRenderer.on('log:entry', (_, log) => callback(log)),
});

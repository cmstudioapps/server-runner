const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(app.getPath('userData'), 'servers.json');

let servers = [];

async function init() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      servers = JSON.parse(raw);
    } else {
      servers = [];
      save();
    }
  } catch (err) {
    console.error('Erro ao carregar servidores:', err);
    servers = [];
  }
}

function save() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(servers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar servidores:', err);
  }
}

function getAllServers() {
  return servers;
}

function getServer(id) {
  return servers.find((s) => s.id === id) || null;
}

function addServer(config) {
  const server = {
    id: uuidv4(),
    name: config.name || 'Novo Servidor',
    projectPath: config.projectPath || '',
    entryFile: config.entryFile || '',
    startCommand: config.startCommand || '',
    port: config.port || 3000,
    icon: config.icon || null,
    status: 'offline',
    pid: null,
    startedAt: null,
    publicUrl: null,
    uptime: null,
    createdAt: new Date().toISOString(),
  };

  servers.push(server);
  save();
  return server;
}

function removeServer(id) {
  servers = servers.filter((s) => s.id !== id);
  save();
}

function updateServer(id, fields) {
  const index = servers.findIndex((s) => s.id === id);
  if (index !== -1) {
    servers[index] = { ...servers[index], ...fields };
    save();
    return servers[index];
  }
  return null;
}

module.exports = {
  init,
  getAllServers,
  getServer,
  addServer,
  removeServer,
  updateServer,
};

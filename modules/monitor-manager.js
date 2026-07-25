const si = require('systeminformation');
const { EventEmitter } = require('events');

const emitter = new EventEmitter();
let intervalId = null;
const INTERVAL_MS = 2000;
let APP_PID = null; // PID do processo Electron

function init(appPid) {
  APP_PID = appPid || process.pid;
}

function start() {
  if (intervalId) return;

  intervalId = setInterval(async () => {
    try {
      // Dados do próprio ServerRunner (processo Electron)
      const appStats = await getProcessStats(APP_PID);

      // Dados de memória total do sistema para referência
      const mem = await si.mem();

      const data = {
        // CPU do app ServerRunner
        cpu: appStats ? appStats.cpu : 0,
        cpuCores: 0,
        // RAM do app ServerRunner
        appRam: appStats ? appStats.ram : 0,
        appRamFormatted: appStats ? appStats.ramFormatted : '0 GB',
        appRamPercent: appStats && mem.total > 0
          ? Math.round((appStats.ram / (mem.total / (1024 * 1024 * 1024))) * 100)
          : 0,
        // RAM total do sistema
        ram: {
          used: Math.round(mem.used / (1024 * 1024 * 1024) * 10) / 10,
          total: Math.round(mem.total / (1024 * 1024 * 1024) * 10) / 10,
          percent: Math.round((mem.used / mem.total) * 100),
        },
      };

      emitter.emit('data', data);
    } catch (err) {
      console.error('Erro no monitoramento:', err);
    }
  }, INTERVAL_MS);
}

/**
 * Retorna estatísticas de CPU/RAM de uma árvore de processos (PID + filhos)
 */
async function getProcessStats(pid) {
  if (!pid) return null;

  try {
    const data = await si.processes();
    const allProcs = data.list || [];

    // BFS para encontrar toda a árvore de processos
    const targetPids = new Set();
    const childMap = new Map();

    allProcs.forEach((p) => {
      const ppid = p.parentPid || 0;
      if (!childMap.has(ppid)) childMap.set(ppid, []);
      childMap.get(ppid).push(p.pid);
    });

    const queue = [pid];
    while (queue.length > 0) {
      const current = queue.shift();
      targetPids.add(current);
      const children = childMap.get(current) || [];
      children.forEach((c) => queue.push(c));
    }

    let cpuTotal = 0;
    let memBytes = 0;

    allProcs.forEach((p) => {
      if (targetPids.has(p.pid)) {
        cpuTotal += p.cpu || 0;
        memBytes += p.mem || 0;
      }
    });

    // Fallback: procura só o PID informado
    if (targetPids.size === 0) {
      const proc = allProcs.find((p) => p.pid === pid);
      if (proc) {
        cpuTotal = proc.cpu || 0;
        memBytes = proc.mem || 0;
      }
    }

    const memGb = Math.round((memBytes / (1024 * 1024 * 1024)) * 100) / 100;

    return {
      cpu: Math.round(cpuTotal * 10) / 10,
      ram: memGb,
      ramFormatted: memGb > 0 ? memGb.toFixed(2) + ' GB' : '< 0.01 GB',
      processes: targetPids.size,
    };
  } catch (err) {
    console.error(`Erro ao buscar stats do PID ${pid}:`, err);
    return null;
  }
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function onData(callback) {
  emitter.on('data', callback);
  start();
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = {
  init,
  start,
  stop,
  onData,
  getProcessStats,
};

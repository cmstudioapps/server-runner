const { spawn, execSync } = require('child_process');
const { EventEmitter } = require('events');

// Map: serverId -> { process, emitter, pid, startTime, logBuffer }
const processes = new Map();
const statusEmitter = new EventEmitter();
const MAX_LOG_BUFFER = 1000; // linhas no buffer

async function start(id, { command, cwd }) {
  if (processes.has(id)) {
    console.warn(`Server ${id} já está em execução`);
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const proc = spawn(command, [], {
        cwd: cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        detached: true,
      });

      const emitter = new EventEmitter();
      const logBuffer = [];

      function appendToBuffer(text) {
        logBuffer.push(text);
        if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
      }

      proc.stdout.on('data', (data) => {
        const str = data.toString();
        appendToBuffer(str);
        emitter.emit('data', str);
      });

      proc.stderr.on('data', (data) => {
        const str = data.toString();
        appendToBuffer(str);
        emitter.emit('data', str);
      });

      proc.on('error', (err) => {
        console.error(`Erro no server ${id}:`, err);
        emitter.emit('error', err.message);
        processes.delete(id);
        statusEmitter.emit(`status:${id}`, 'offline');
      });

      proc.on('exit', (code) => {
        const msg = `[Processo encerrado com código ${code}]\n`;
        appendToBuffer(msg);
        emitter.emit('data', msg);
        emitter.emit('exit', code);
        processes.delete(id);
        statusEmitter.emit(`status:${id}`, 'offline');
      });

      processes.set(id, {
        process: proc,
        emitter,
        pid: proc.pid,
        startTime: Date.now(),
        logBuffer,
      });

      statusEmitter.emit(`status:${id}`, 'online');
      setTimeout(() => resolve(), 800);
    } catch (err) {
      reject(err);
    }
  });
}

function attach(id, { pid, startTime = Date.now(), logBuffer = [] } = {}) {
  if (!id || !pid) return null;

  if (processes.has(id)) {
    const current = processes.get(id);
    current.pid = pid;
    current.startTime = startTime;
    if (Array.isArray(logBuffer)) current.logBuffer = logBuffer;
    return current;
  }

  const emitter = new EventEmitter();
  processes.set(id, {
    process: null,
    emitter,
    pid,
    startTime,
    logBuffer: Array.isArray(logBuffer) ? logBuffer : [],
  });

  statusEmitter.emit(`status:${id}`, 'online');
  return processes.get(id);
}

async function stop(id) {
  const entry = processes.get(id);
  if (!entry) return;

  const { process: proc, pid } = entry;

  return new Promise((resolve) => {
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      processes.delete(id);
      statusEmitter.emit(`status:${id}`, 'offline');
      resolve();
    };

    if (!proc) {
      try {
        killProcessTree(pid);
      } catch {}
      finalize();
      return;
    }

    const timeout = setTimeout(() => {
      try { killProcessTree(proc.pid); } catch {}
      finalize();
    }, 5000);

    proc.on('exit', () => {
      clearTimeout(timeout);
      finalize();
    });

    try {
      killProcessTree(proc.pid);
    } catch {
      clearTimeout(timeout);
      finalize();
    }
  });
}

/** Envia comando para o stdin do servidor */
function write(id, input) {
  const entry = processes.get(id);
  if (entry && entry.process && entry.process.stdin) {
    try {
      entry.process.stdin.write(input);
    } catch (err) {
      console.error(`Erro ao escrever no stdin do server ${id}:`, err);
    }
  }
}

function killProcessTree(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      execSync(`kill -TERM -$(ps -o pgid= -p ${pid} | tr -d ' ') 2>/dev/null || kill -TERM ${pid}`, { stdio: 'ignore' });
    }
  } catch {}
}

function getPid(id) {
  const entry = processes.get(id);
  return entry ? entry.pid : null;
}

function getStartTime(id) {
  const entry = processes.get(id);
  return entry ? entry.startTime : null;
}

function getLogBuffer(id) {
  const entry = processes.get(id);
  return entry ? entry.logBuffer : [];
}

/** Escuta output do servidor */
function onData(id, callback) {
  const entry = processes.get(id);
  if (entry) {
    entry.emitter.on('data', callback);
  } else {
    // Se o servidor não está rodando, registra mesmo assim
    // (o callback será chamado quando o servidor iniciar se usar onStatus)
  }
}

function offData(id, callback) {
  const entry = processes.get(id);
  if (entry) {
    entry.emitter.off('data', callback);
  }
}

function onStatus(id, callback) {
  statusEmitter.on(`status:${id}`, callback);
}

function offStatus(id, callback) {
  statusEmitter.off(`status:${id}`, callback);
}

function getProcess(id) {
  return processes.get(id) || null;
}

function isRunning(id) {
  return processes.has(id);
}

function getAllPids() {
  const result = [];
  for (const [id, entry] of processes) {
    if (entry.pid) result.push({ id, pid: entry.pid });
  }
  return result;
}

module.exports = {
  start,
  attach,
  stop,
  write,
  onData,
  offData,
  onStatus,
  offStatus,
  getProcess,
  getPid,
  getStartTime,
  getLogBuffer,
  isRunning,
  getAllPids,
};

const os = require('os');
const { EventEmitter } = require('events');
const ServerManager = require('./server-manager');

let pty;
try {
  pty = require('node-pty');
} catch {
  console.warn('node-pty não disponível, terminal interativo desativado');
  pty = null;
}

// Map: serverId -> { terminal, emitter }
const terminals = new Map();
const emitter = new EventEmitter();
const serverStatusListeners = new Map();
const serverOutputListeners = new Map();

/**
 * Cria um terminal interativo real (shell) no diretório do projeto.
 * Também se conecta ao output do servidor se ele estiver rodando.
 */
function create(id, { cwd } = {}) {
  if (terminals.has(id)) kill(id);

  const defaultCwd = cwd || process.cwd();

  if (pty) {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    const shellArgs = os.platform() === 'win32' ? [] : ['--noprofile', '--norc'];
    const term = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: defaultCwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        PS1: '',
        PS2: '',
        PROMPT_COMMAND: '',
      },
    });

    term.onData((data) => {
      emitter.emit(`data:${id}`, data);
    });

    term.onExit(() => {
      terminals.delete(id);
    });

    terminals.set(id, { terminal: term, type: 'pty', cwd: defaultCwd });

    if (os.platform() !== 'win32') {
      try {
        term.write('stty -echo 2>/dev/null\n');
      } catch {}
    }

    const statusListener = (status) => {
      if (status === 'online') {
        attachServerOutput(id);
      } else if (status === 'offline') {
        detachServerOutput(id);
      }
    };
    serverStatusListeners.set(id, statusListener);
    ServerManager.onStatus(id, statusListener);

    if (ServerManager.isRunning(id)) {
      attachServerOutput(id);
    }
  } else {
    // Fallback: sem PTY, usa só o output do servidor
    const fakeEm = new EventEmitter();
    const fake = {
      write: (data) => emitter.emit(`data:${id}`, data),
      kill: () => terminals.delete(id),
      resize: () => {},
      onData: () => {},
    };
    terminals.set(id, { terminal: fake, type: 'fake' });

    const buffer = ServerManager.getLogBuffer(id);
    if (buffer && buffer.length > 0) {
      buffer.forEach((chunk) => emitter.emit(`data:${id}`, chunk));
    }
    const listener = (data) => {
      emitter.emit(`data:${id}`, data);
    };
    serverOutputListeners.set(id, listener);
    ServerManager.onData(id, listener);

    const statusListener = (status) => {
      if (status === 'online') {
        attachServerOutput(id);
      } else if (status === 'offline') {
        detachServerOutput(id);
      }
    };
    serverStatusListeners.set(id, statusListener);
    ServerManager.onStatus(id, statusListener);

    if (ServerManager.isRunning(id)) {
      attachServerOutput(id);
    }
  }
}

function write(id, input) {
  const entry = terminals.get(id);
  if (entry && entry.terminal) {
    try { entry.terminal.write(input); } catch {}
  }
}

function kill(id) {
  const entry = terminals.get(id);
  const statusListener = serverStatusListeners.get(id);
  if (statusListener) {
    ServerManager.offStatus(id, statusListener);
    serverStatusListeners.delete(id);
  }
  const serverListener = serverOutputListeners.get(id);
  if (serverListener) {
    detachServerOutput(id);
  }
  if (entry) {
    if (entry.type === 'pty') {
      try { entry.terminal.kill(); } catch {}
    }
    terminals.delete(id);
  }
}

function killAll() {
  for (const id of terminals.keys()) kill(id);
}

function disconnect(id) {
  kill(id);
}

function onData(id, callback) {
  emitter.on(`data:${id}`, callback);
}

function offData(id, callback) {
  emitter.off(`data:${id}`, callback);
}

function attachServerOutput(id) {
  const entry = terminals.get(id);
  if (!entry || serverOutputListeners.has(id)) return;

  const listener = (data) => {
    try {
      emitter.emit(`data:${id}`, data);
    } catch {}
  };

  serverOutputListeners.set(id, listener);
  ServerManager.onData(id, listener);

  if (ServerManager.isRunning(id)) {
    const buffer = ServerManager.getLogBuffer(id);
    if (buffer && buffer.length > 0) {
      buffer.forEach((chunk) => {
        try {
          emitter.emit(`data:${id}`, chunk);
        } catch {}
      });
    }
  }
}

function detachServerOutput(id) {
  const listener = serverOutputListeners.get(id);
  if (listener) {
    ServerManager.offData(id, listener);
    serverOutputListeners.delete(id);
  }
}

function resize(id, cols, rows) {
  const entry = terminals.get(id);
  if (entry && entry.type === 'pty') {
    try { entry.terminal.resize(cols, rows); } catch {}
  }
}

module.exports = {
  create,
  write,
  kill,
  killAll,
  disconnect,
  onData,
  offData,
  attachServerOutput,
  detachServerOutput,
  resize,
};

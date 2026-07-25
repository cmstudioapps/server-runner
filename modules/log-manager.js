const { EventEmitter } = require('events');

const emitter = new EventEmitter();
const MAX_LOGS = 500;
const logs = [];

function add(entry) {
  const log = {
    id: logs.length + 1,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  logs.push(log);
  if (logs.length > MAX_LOGS) logs.shift();

  emitter.emit('log', log);
  return log;
}

function info(message, data = {}) {
  return add({ type: 'info', message, data });
}

function success(message, data = {}) {
  return add({ type: 'success', message, data });
}

function warn(message, data = {}) {
  return add({ type: 'warning', message, data });
}

function error(message, data = {}) {
  return add({ type: 'error', message, data });
}

function getAll() {
  return [...logs];
}

function clear() {
  logs.length = 0;
  emitter.emit('cleared');
}

function onLog(callback) {
  emitter.on('log', callback);
}

function onCleared(callback) {
  emitter.on('cleared', callback);
}

module.exports = {
  info,
  success,
  warn,
  error,
  getAll,
  clear,
  onLog,
  onCleared,
};

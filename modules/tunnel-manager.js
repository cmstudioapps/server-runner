const localtunnel = require('localtunnel');

// Map: serverId -> tunnel instance
const tunnels = new Map();

async function startTunnel(serverId, port) {
  // Se já existe um tunnel, retorna a URL atual
  if (tunnels.has(serverId)) {
    return tunnels.get(serverId).url;
  }

  try {
    const tunnel = await localtunnel({
      port: parseInt(port),
      subdomain: getRandomSubdomain(),
    });

    tunnel.on('close', () => {
      tunnels.delete(serverId);
    });

    tunnel.on('error', (err) => {
      console.error(`Tunnel error for ${serverId}:`, err);
      tunnels.delete(serverId);
    });

    tunnels.set(serverId, tunnel);

    return tunnel.url;
  } catch (err) {
    console.error(`Erro ao criar tunnel para ${serverId}:`, err);
    throw new Error(`Não foi possível criar tunnel: ${err.message}`);
  }
}

function stopTunnel(serverId) {
  const tunnel = tunnels.get(serverId);
  if (tunnel) {
    try {
      tunnel.close();
    } catch {}
    tunnels.delete(serverId);
  }
}

function getTunnelUrl(serverId) {
  const tunnel = tunnels.get(serverId);
  return tunnel ? tunnel.url : null;
}

function getRandomSubdomain() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'sr-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  startTunnel,
  stopTunnel,
  getTunnelUrl,
};

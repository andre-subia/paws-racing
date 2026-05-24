function defaultServerUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:2567';
  const { protocol, hostname, host } = window.location;
  // Local development: connect straight to the Colyseus port.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:2567';
  }
  // Shared via ngrok / hosted: go through the Vite /colyseus proxy on the
  // same host, so a single tunnel forwards both the page and the game.
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${host}/colyseus`;
}

export const config = {
  serverUrl: import.meta.env.VITE_SERVER_URL ?? defaultServerUrl(),
};

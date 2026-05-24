function defaultServerUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:2567';
  const { protocol, hostname, host } = window.location;
  // Local development: connect straight to the Colyseus port.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:2567';
  }
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  // Dev sharing via ngrok still goes through Vite's /colyseus proxy. In a
  // production build (single-host: server serves the client static files
  // and also speaks Colyseus on the same port) the WS lives at the root.
  if (import.meta.env.DEV) {
    return `${wsProto}//${host}/colyseus`;
  }
  return `${wsProto}//${host}`;
}

export const config = {
  serverUrl: import.meta.env.VITE_SERVER_URL ?? defaultServerUrl(),
};

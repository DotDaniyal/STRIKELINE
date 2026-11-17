import type { ClientMessage, ServerMessage } from '../../shared/types/game.ts';

type Listener = (msg: ServerMessage) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners = new Set<Listener>();
  private pingTimer: number | null = null;
  public connected = false;
  public pingMs = 0;

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public connect(token: string) {
    this.token = token;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'auth', token });
      }
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      if (this.token) {
        this.send({ type: 'auth', token: this.token });
      }
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => {
        this.send({ type: 'ping', clientTime: Date.now() });
      }, 2500);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMessage;
        if (msg.type === 'pong') {
          this.pingMs = Math.max(1, Date.now() - msg.clientTime);
        }
        for (const fn of this.listeners) fn(msg);
      } catch {
        // Ignore malformed frame
      }
    };

    ws.onclose = () => {
      this.connected = false;
      if (this.pingTimer) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      // Auto-reconnect if session token still present
      if (this.token) {
        window.setTimeout(() => {
          if (this.token) this.connect(this.token);
        }, 2000);
      }
    };
  }

  public disconnect() {
    this.token = null;
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  public send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

export const socketClient = new SocketClient();

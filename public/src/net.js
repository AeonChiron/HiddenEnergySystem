// Connection to the game server. Reconnects on its own (phones sleep, Wi-Fi
// blips) and lets the caller re-identify itself through onOpen.
// A preview build can pass a different transport with the same shape.

export function connect({ url, onOpen, onMessage, onStatus } = {}) {
  const wsUrl = url || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  let ws = null;
  let closed = false;
  let attempt = 0;
  let offset = 0; // serverNow - localNow
  const queue = [];

  function status(s) { onStatus && onStatus(s); }

  function open() {
    status(attempt ? 'reconnecting' : 'connecting');
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      attempt = 0;
      status('online');
      ws.send(JSON.stringify({ t: 'ping', at: Date.now() }));
      onOpen && onOpen();
      while (queue.length) ws.send(queue.shift());
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'pong') {
        const rtt = Date.now() - msg.at;
        offset = msg.serverNow + rtt / 2 - Date.now();
        return;
      }
      onMessage && onMessage(msg);
    };
    ws.onclose = () => {
      if (closed) return;
      status('reconnecting');
      const wait = Math.min(5000, 400 * 2 ** attempt++) + Math.random() * 300;
      setTimeout(open, wait);
    };
    ws.onerror = () => {};
  }

  // Reconnect at once when a phone wakes up or the tab comes back.
  const wake = () => { if (document.visibilityState === 'visible' && ws && ws.readyState > 1 && !closed) { attempt = 0; open(); } };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);

  open();

  return {
    send(obj) {
      const s = JSON.stringify(obj);
      if (ws && ws.readyState === 1) ws.send(s);
      else queue.push(s);
    },
    serverOffset: () => offset,
    close() { closed = true; ws && ws.close(); },
  };
}

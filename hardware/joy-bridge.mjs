// Bluetooth → browser bridge for the Arduino joystick (Vite dev-server plugin).
//
// Linux exposes a paired HC-05 as a serial device once it is bound with
//   sudo rfcomm bind 0 <HC-05 MAC> 1      →  /dev/rfcomm0
// Browsers can't always open /dev/rfcomm*, so the dev server opens it and streams the
// raw "J,..." lines to the game at GET /joy-bridge (src/joystick.js connects on its own).
// Set JOY_PORT to use another device, e.g. JOY_PORT=/dev/rfcomm1 npm run dev
import fs from 'node:fs';
import { execFile } from 'node:child_process';

const PORT = process.env.JOY_PORT || '/dev/rfcomm0';

export function joyBridge() {
  let stream = null, opening = null, lastMsg = '';
  const log = (m) => { if (m !== lastMsg) { lastMsg = m; console.log(`[joy-bridge] ${m}`); } }; // no repeats while it retries
  const clients = new Set();

  const close = () => {
    const s = stream;
    stream = null;
    for (const c of clients) c.end();
    clients.clear();
    s?.destroy();
  };

  // Opening an rfcomm device makes the Bluetooth connection (takes a few seconds).
  const open = () => {
    if (stream) return Promise.resolve(true);
    if (opening) return opening;
    opening = new Promise((resolve) => {
      if (!fs.existsSync(PORT)) return resolve(false);
      // raw mode, no echo: otherwise the tty would echo data back to the controller
      execFile('stty', ['-F', PORT, 'raw', '-echo', '9600'], { timeout: 25000 }, (err, _o, stderr) => {
        if (err) { log(`${PORT}: ${(stderr || err.message).trim().replace(/^stty: /, '')} (is the controller on and paired?)`); return resolve(false); }
        const s = fs.createReadStream(PORT, { highWaterMark: 256 });
        s.on('open', () => { stream = s; log(`connected to ${PORT}`); resolve(true); });
        s.on('data', (d) => { for (const c of clients) c.write(d); });
        const end = (e) => {
          if (stream === s) { log(`${PORT} closed${e?.message ? ': ' + e.message : ''}`); close(); }
          resolve(false);
        };
        s.on('error', end);
        s.on('close', end);
      });
    }).finally(() => { opening = null; });
    return opening;
  };

  return {
    name: 'escape-joy-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/joy-bridge', async (req, res) => {
        const ok = await open();
        if (!ok) { res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Joy-Port': 'none' }); res.end(); return; } // 200 + "none": no console error
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Joy-Port': PORT.replace('/dev/', '') });
        res.flushHeaders();
        clients.add(res);
        // last tab closed → release the device (and the Bluetooth link)
        req.on('close', () => { clients.delete(res); if (!clients.size) setTimeout(() => { if (!clients.size) close(); }, 2000); });
      });
      server.httpServer?.on('close', close);
    },
  };
}

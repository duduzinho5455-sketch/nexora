// Postgres local de teste (PGlite) + porta de controle para simular "banco fora do ar".
// Uso: node pg-ctl.mjs <porta>    (controle HTTP em porta+1000: /stop, /start)
import http from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.argv[2] || 54401);
const db = new PGlite();
await db.waitReady;
let srv = null;
const up = async () => { if (srv) return; srv = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 30 }); await srv.start(); };
const down = async () => { if (!srv) return; const s = srv; srv = null; await s.stop(); };
await up();
http.createServer(async (req, res) => {
  try {
    if (req.url === "/stop") await down();
    else if (req.url === "/start") await up();
    res.end(srv ? "on" : "off");
  } catch (e) { res.statusCode = 500; res.end(String(e.message)); }
}).listen(port + 1000, "127.0.0.1", () => console.log("PGLITE_READY " + port));

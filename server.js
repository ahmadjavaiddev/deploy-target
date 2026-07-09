const { createServer } = require("node:http");

const NAME = "deploy-target";
const VERSION = process.env.VERSION || "0.0.0";
const FAIL_AFTER_SEC = Number(process.env.FAIL_AFTER_SEC || 0);
const startedAt = Date.now();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

  if (req.url === "/") {
    return send(res, 200, { name: NAME, version: VERSION });
  }

  if (req.url === "/health") {
    if (FAIL_AFTER_SEC > 0 && uptimeSec >= FAIL_AFTER_SEC) {
      return send(res, 500, {
        status: "unhealthy",
        version: VERSION,
        uptimeSec,
        error: "simulated failure — health degrades after FAIL_AFTER_SEC uptime",
      });
    }
    return send(res, 200, { status: "healthy", version: VERSION, uptimeSec });
  }

  send(res, 404, { error: "not found" });
});

server.listen(3000, () => {
  console.log(`${NAME} v${VERSION} listening on :3000 (FAIL_AFTER_SEC=${FAIL_AFTER_SEC})`);
});

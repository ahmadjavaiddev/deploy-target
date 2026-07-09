const { createServer } = require("node:http");
const { NAME, respond } = require("./app");

const VERSION = "1.1.0";
const FAIL_AFTER_SEC = 0;
const FAIL_HEALTH = false;
const startedAt = Date.now();

const server = createServer((req, res) => {
  const { status, body } = respond(req.url, {
    version: VERSION,
    failAfterSec: FAIL_AFTER_SEC,
    failHealth: FAIL_HEALTH,
    startedAt,
  });
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
});

server.listen(3000, () => {
  console.log(
    `${NAME} v${VERSION} listening on :3000 (FAIL_AFTER_SEC=${FAIL_AFTER_SEC}, FAIL_HEALTH=${FAIL_HEALTH})`,
  );
});

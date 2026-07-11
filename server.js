const { createServer } = require("node:http");
const { NAME, respond } = require("./app");
const { BUILD_TIME } = require("./build-time");

const VERSION = "1.4.1";
const FAIL_AFTER_SEC = 0;
const FAIL_HEALTH = false;

const server = createServer((req, res) => {
  const { status, body, contentType } = respond(req.url, {
    version: VERSION,
    failAfterSec: FAIL_AFTER_SEC,
    failHealth: FAIL_HEALTH,
    startedAt: BUILD_TIME,
  });
  res.writeHead(status, { "Content-Type": contentType ?? "application/json" });
  res.end(contentType ? body : JSON.stringify(body));
});

server.listen(3000, () => {
  console.log(
    `${NAME} v${VERSION} listening on :3000 (FAIL_AFTER_SEC=${FAIL_AFTER_SEC}, health degrades once now-BUILD_TIME>${FAIL_AFTER_SEC}s)`,
  );
});

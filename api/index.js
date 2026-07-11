const { respond } = require("../app");
const { BUILD_TIME } = require("../build-time");

const VERSION = "1.4.2";
const FAIL_AFTER_SEC = 0;
const FAIL_HEALTH = true;

module.exports = (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const { status, body, contentType } = respond(path, {
    version: VERSION,
    failAfterSec: FAIL_AFTER_SEC,
    failHealth: FAIL_HEALTH,
    startedAt: BUILD_TIME,
  });
  res.statusCode = status;
  res.setHeader("Content-Type", contentType ?? "application/json");
  res.end(contentType ? body : JSON.stringify(body));
};

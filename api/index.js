const { respond } = require("../app");
const { BUILD_TIME } = require("../build-time");

const VERSION = "1.3.0";
const FAIL_AFTER_SEC = 60;
const FAIL_HEALTH = false;

module.exports = (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const { status, body } = respond(path, {
    version: VERSION,
    failAfterSec: FAIL_AFTER_SEC,
    failHealth: FAIL_HEALTH,
    startedAt: BUILD_TIME,
  });
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

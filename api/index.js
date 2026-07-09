const { respond } = require("../app");

const VERSION = process.env.VERSION || "0.0.0";
const FAIL_AFTER_SEC = Number(process.env.FAIL_AFTER_SEC || 0);
const FAIL_HEALTH = process.env.FAIL_HEALTH === "1" || process.env.FAIL_HEALTH === "true";
const startedAt = Date.now();

module.exports = (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const { status, body } = respond(path, {
    version: VERSION,
    failAfterSec: FAIL_AFTER_SEC,
    failHealth: FAIL_HEALTH,
    startedAt,
  });
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const NAME = "deploy-target";

function respond(url, { version, failAfterSec, failHealth, startedAt }) {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

  if (url === "/home") {
    const html = [
      "<!doctype html><html><head><title>deploy-target</title></head><body>",
      "<h1>deploy-target</h1>",
      '<button style="background:#2563eb;color:#fff;border:0;padding:10px 18px;border-radius:6px">Check status</button>',
      "</body></html>",
    ].join("");
    return { status: 200, body: html, contentType: "text/html" };
  }

  if (url === "/") {
    return { status: 200, body: { name: NAME, version } };
  }

  if (url === "/health") {
    const timedOut = failAfterSec > 0 && uptimeSec >= failAfterSec;
    if (failHealth || timedOut) {
      return {
        status: 500,
        body: {
          status: "unhealthy",
          version,
          uptimeSec,
          error: failHealth
            ? "unconditional failure — this build is bad (FAIL_HEALTH set)"
            : "simulated failure — health degrades after FAIL_AFTER_SEC uptime",
        },
      };
    }
    return { status: 200, body: { status: "healthy", message: "all good — serving traffic normally", version, uptimeSec } };
  }

  return { status: 404, body: { error: "not found" } };
}

module.exports = { NAME, respond };

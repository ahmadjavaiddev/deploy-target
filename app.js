const NAME = "deploy-target";

function respond(url, { version, failAfterSec, failHealth, startedAt }) {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

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
    return { status: 200, body: { status: "healthy", version, uptimeSec } };
  }

  return { status: 404, body: { error: "not found" } };
}

module.exports = { NAME, respond };

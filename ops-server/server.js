const { createServer } = require("node:http");
const { execFile } = require("node:child_process");
const { readFile, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { promisify } = require("node:util");

const run = promisify(execFile);

const IMAGE_REPO = process.env.IMAGE_REPO || "ghcr.io/ahmadjavaiddev/deploy-target";
const CONTAINER_NAME = process.env.CONTAINER_NAME || "deploy-target";
const HOST_PORT = Number(process.env.TARGET_PORT || 3000);
const OPS_PORT = Number(process.env.OPS_PORT || 4000);
const TARGET_URL = `http://localhost:${HOST_PORT}`;
const STATE_FILE = join(__dirname, ".ops-state.json");
const OPS_TOKEN = process.env.OPS_TOKEN || "";

const TAG_RE = /^[a-zA-Z0-9._-]+$/;

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch {
    return { previousTag: null };
  }
}

async function writeState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function currentImageTag() {
  try {
    const { stdout } = await run("docker", [
      "inspect",
      "--format",
      "{{.Config.Image}}",
      CONTAINER_NAME,
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function swapContainer(image) {
  await run("docker", ["pull", image]);
  try {
    await run("docker", ["rm", "-f", CONTAINER_NAME]);
  } catch {}
  await run("docker", [
    "run",
    "-d",
    "--name",
    CONTAINER_NAME,
    "--restart",
    "unless-stopped",
    "-p",
    `${HOST_PORT}:3000`,
    image,
  ]);
}

async function proxyTargetHealth() {
  try {
    const res = await fetch(`${TARGET_URL}/health`);
    const body = await res.json();
    return { reachable: true, httpStatus: res.status, ...body };
  } catch (e) {
    return { reachable: false, httpStatus: 0, error: e.message };
  }
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function authorized(req) {
  if (OPS_TOKEN) return req.headers["x-ops-token"] === OPS_TOKEN;
  const ip = req.socket.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

async function handleDeploy(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { ok: false, error: "invalid JSON body" });
  }
  const tag = String(body.tag || "").trim();
  if (!TAG_RE.test(tag)) {
    return send(res, 400, { ok: false, error: `invalid tag: ${JSON.stringify(tag)}` });
  }
  const image = `${IMAGE_REPO}:${tag}`;
  const previous = await currentImageTag();
  if (previous && previous !== image) await writeState({ previousTag: previous });
  try {
    await swapContainer(image);
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
  return send(res, 200, { ok: true, deployed: image, previous });
}

async function handleHealth(_req, res) {
  const target = await proxyTargetHealth();
  const runningImage = await currentImageTag();
  return send(res, 200, { target, runningImage });
}

async function handleRollback(req, res) {
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {
    return send(res, 400, { ok: false, error: "invalid JSON body" });
  }
  const explicitTag = body.toTag ? String(body.toTag).trim() : "";
  let toImage;
  if (explicitTag) {
    if (!TAG_RE.test(explicitTag)) {
      return send(res, 400, { ok: false, error: `invalid toTag: ${JSON.stringify(explicitTag)}` });
    }
    toImage = `${IMAGE_REPO}:${explicitTag}`;
  } else {
    const { previousTag } = await readState();
    if (!previousTag) {
      return send(res, 409, { ok: false, error: "no previous tag recorded — nothing to roll back to" });
    }
    toImage = previousTag;
  }
  const from = await currentImageTag();
  try {
    await swapContainer(toImage);
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
  if (from && from !== toImage) await writeState({ previousTag: from });
  return send(res, 200, { ok: true, rolledBackTo: toImage, from });
}

const server = createServer((req, res) => {
  if (!authorized(req)) {
    return send(res, 401, { ok: false, error: "invalid or missing x-ops-token" });
  }
  if (req.method === "GET" && req.url === "/health") return void handleHealth(req, res);
  if (req.method === "POST" && req.url === "/deploy") return void handleDeploy(req, res);
  if (req.method === "POST" && req.url === "/rollback") return void handleRollback(req, res);
  send(res, 404, { ok: false, error: "not found" });
});

server.listen(OPS_PORT, () => {
  console.log(`deploy-target ops-server listening on :${OPS_PORT} (target container ${CONTAINER_NAME} -> :${HOST_PORT})`);
});

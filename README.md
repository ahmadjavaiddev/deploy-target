# deploy-target

The demo service the [c-brain](https://github.com/ahmadjavaiddev/c-brain) agent deploys. This
repo is a standalone sibling to c-brain, shaped like a real company's app: a minimal Node.js
HTTP service (`server.js`, `Dockerfile`, `package.json`) at the root, plus a tiny `ops-server/`
that runs beside Docker on the target VPS and does the actual container swap.

Public repo, on purpose: keeping it public means the VPS can `docker pull` from GHCR without
auth. It's a demo service — a fake "product" with a health endpoint and a version number,
nothing sensitive lives here.

## What it is

The pilot deploy flow proves the c-brain agent can deploy, verify, and roll back a real
service on a real internet-reachable host. The agent talks to `ops-server` over
`DEPLOY_SERVICE` / `GET_SERVICE_HEALTH` / `ROLLBACK_SERVICE`, which hit `OPS_BASE_URL` (set on
the c-brain side) instead of a hardcoded local endpoint.

## The three-version matrix

`server.js` (container/VPS) and `api/index.js` (Vercel serverless) share the routing in `app.js`,
reading `VERSION`, `FAIL_AFTER_SEC`, and `FAIL_HEALTH` from the environment and serving:

- `GET /` → `{ name: "deploy-target", version }`
- `GET /health` → `{ status: "healthy", version, uptimeSec }`, or a 500
  `{ status: "unhealthy", ... }` when `FAIL_HEALTH` is set (unconditional) or once uptime passes
  `FAIL_AFTER_SEC` — a bad build.

`FAIL_HEALTH=1` fails every `/health` call unconditionally; `FAIL_AFTER_SEC=N` fails only after N
seconds of uptime. On serverless (Vercel) uptime resets per invocation so `FAIL_AFTER_SEC` can't
fire — the bad version there uses `FAIL_HEALTH=1`. `FAIL_AFTER_SEC` stays for container/VPS runs.

Three images, built with `--build-arg VERSION=... FAIL_AFTER_SEC=...`:

| tag    | VERSION | knob             | behavior                             |
|--------|---------|------------------|--------------------------------------|
| v1.0.0 | 1.0.0   | none             | good                                 |
| v1.1.0 | 1.1.0   | none             | good                                 |
| v1.2.0 | 1.2.0   | FAIL_AFTER_SEC=20 (container) / FAIL_HEALTH=1 (serverless) | health 500s (bad) |

## Vercel deployment shape

The account is a Hobby ("northstar", limited) plan, so container/Dockerfile deployments aren't
available — the service runs on Vercel's Node runtime with `server.js` auto-detected as the root
entrypoint (`api/index.js` + `vercel.json` are a serverless-function fallback of the same `app.js`
logic). Each version is a separate `vercel deploy` carrying `-m version=vX.Y.Z` meta and its
`-e VERSION=... [-e FAIL_HEALTH=1]` env, so deploy-by-version is scriptable: find the deployment
by its `version` meta tag and point the production alias (`deploy-target-lyart.vercel.app`) at it.
Rollback re-points the alias at the previously-aliased deployment. This is exactly what c-brain's
`OPS_BACKEND=vercel` driver does behind the same three ops tools.

`.github/workflows/build-images.yml` builds and pushes all three to
`ghcr.io/ahmadjavaiddev/deploy-target:{v1.0.0,v1.1.0,v1.2.0}` on every push to `main` (and on
`workflow_dispatch`). `.github/workflows/ci.yml` runs a smoke check (boot `server.js`, hit
`/health`, expect 200) on every push — this is the real, checkable workflow-run signal the
c-brain agent's prepare-step reads before it deploys.

To build locally instead:

```
./build.sh        # or build.ps1 on Windows
docker push ghcr.io/ahmadjavaiddev/deploy-target:v1.0.0
docker push ghcr.io/ahmadjavaiddev/deploy-target:v1.1.0
docker push ghcr.io/ahmadjavaiddev/deploy-target:v1.2.0
```

(Needs `docker login ghcr.io` with a PAT that has `write:packages`.)

## ops-server

A standalone Node service (`ops-server/server.js`, no dependencies) that runs on the VPS
beside Docker and does the container swap the agent asks for.

Endpoints (all require `x-ops-token: $OPS_TOKEN` — if `OPS_TOKEN` is unset, only loopback
requests are allowed):

- `POST /deploy { tag }` — `docker pull ghcr.io/ahmadjavaiddev/deploy-target:<tag>`, stop+rm
  the running `deploy-target` container, run the new image on port 3000, record the previous
  image tag to `.ops-state.json`.
- `GET /health` — proxies the target's own `/health` and reports the currently running image
  tag (`docker inspect --format '{{.Config.Image}}' deploy-target`).
- `POST /rollback { toTag? }` — redeploys `toTag` if given, else the last-good tag recorded in
  `.ops-state.json`.

Env vars: `OPS_TOKEN` (shared secret), `OPS_PORT` (default 4000), `TARGET_PORT` (default
3000), `IMAGE_REPO` (default `ghcr.io/ahmadjavaiddev/deploy-target`), `CONTAINER_NAME`
(default `deploy-target`).

### Running ops-server on the VPS — two options

**Option A — Docker (recommended):** build the ops-server image and run it with the Docker
socket mounted so it can control sibling containers:

```
cd ops-server
docker build -t deploy-target-ops-server .
docker run -d --name ops-server --restart unless-stopped \
  -p 4000:4000 \
  -e OPS_TOKEN=<shared-secret> \
  -v /var/run/docker.sock:/var/run/docker.sock \
  deploy-target-ops-server
```

**Option B — systemd (bare Node, no container-in-container):**

```
# /etc/systemd/system/deploy-target-ops.service
[Unit]
Description=deploy-target ops-server
After=network.target docker.service

[Service]
Environment=OPS_TOKEN=<shared-secret>
Environment=OPS_PORT=4000
WorkingDirectory=/opt/deploy-target/ops-server
ExecStart=/usr/bin/node server.js
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl daemon-reload
sudo systemctl enable --now deploy-target-ops.service
```

## VPS runbook

1. Provision the VPS (Hostinger or similar), SSH in.
2. Install Docker:
   ```
   curl -fsSL https://get.docker.com | sh
   sudo systemctl enable --now docker
   ```
3. This repo is public, so `docker pull ghcr.io/ahmadjavaiddev/deploy-target:<tag>` works on
   the VPS with no login required.
4. Copy `ops-server/` to the VPS (`scp -r ops-server root@<vps-ip>:/opt/deploy-target/ops-server`).
5. Run ops-server via Option A or Option B above, setting `OPS_TOKEN` to a real shared secret.
6. Open the firewall for the ops port and the target app port:
   ```
   sudo ufw allow 4000/tcp   # ops-server
   sudo ufw allow 3000/tcp   # deploy-target (only if it must be reachable directly)
   sudo ufw enable
   ```
7. Point c-brain at it: set `OPS_BASE_URL=http://<vps-ip>:4000` and `OPS_API_TOKEN=<shared-secret>`
   in the c-brain API env — the demo-ops tools (`DEPLOY_SERVICE` / `GET_SERVICE_HEALTH` /
   `ROLLBACK_SERVICE`) will call the VPS instead of the local `/api/ops` router. No code change
   needed on the c-brain side; `OPS_BASE_URL` defaults to the local endpoint so nothing breaks
   until it's set.
8. Seed the first deploy manually once to prove reachability:
   ```
   curl -X POST http://<vps-ip>:4000/deploy \
     -H "x-ops-token: <shared-secret>" -H "Content-Type: application/json" \
     -d '{"tag":"v1.0.0"}'
   curl -H "x-ops-token: <shared-secret>" http://<vps-ip>:4000/health
   ```

VPS provisioning itself (steps 1–2, 6) happens separately once the host is available — this
README is the runbook for that pass; nothing here requires it to be done locally first.

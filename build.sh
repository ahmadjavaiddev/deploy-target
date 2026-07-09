#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

REPO="ghcr.io/ahmadjavaiddev/deploy-target"

docker build -t "${REPO}:v1.0.0" --build-arg VERSION=1.0.0 .
docker build -t "${REPO}:v1.1.0" --build-arg VERSION=1.1.0 .
docker build -t "${REPO}:v1.2.0" --build-arg VERSION=1.2.0 --build-arg FAIL_AFTER_SEC=20 .

echo "Built: ${REPO}:v1.0.0 ${REPO}:v1.1.0 ${REPO}:v1.2.0"
echo "Push (needs GHCR auth): docker push ${REPO}:v1.0.0 && docker push ${REPO}:v1.1.0 && docker push ${REPO}:v1.2.0"

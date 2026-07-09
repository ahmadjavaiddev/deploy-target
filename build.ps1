$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Repo = "ghcr.io/ahmadjavaiddev/deploy-target"

docker build -t "${Repo}:v1.0.0" --build-arg VERSION=1.0.0 .
docker build -t "${Repo}:v1.1.0" --build-arg VERSION=1.1.0 .
docker build -t "${Repo}:v1.2.0" --build-arg VERSION=1.2.0 --build-arg FAIL_AFTER_SEC=20 .

Write-Host "Built: ${Repo}:v1.0.0 ${Repo}:v1.1.0 ${Repo}:v1.2.0"
Write-Host "Push (needs GHCR auth): docker push ${Repo}:v1.0.0; docker push ${Repo}:v1.1.0; docker push ${Repo}:v1.2.0"

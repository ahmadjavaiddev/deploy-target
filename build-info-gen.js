const { writeFileSync, mkdirSync } = require("node:fs");

mkdirSync("public", { recursive: true });
writeFileSync("public/index.html", "<!doctype html><title>deploy-target</title>\n");
writeFileSync("build-info.js", `module.exports = { BUILD_TIME: ${Date.now()} };\n`);

console.log(`baked BUILD_TIME=${Date.now()}`);

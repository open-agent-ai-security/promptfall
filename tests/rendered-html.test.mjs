import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Promptfall game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Promptfall<\/title>/i);
  assert.match(html, /Promptfall game/i);
  assert.doesNotMatch(html, /Risk Matrix/i);
  assert.match(html, /community-logo\.svg/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships social metadata and accessible controls", async () => {
  const response = await render();
  const html = await response.text();
  const gameSource = await readFile(
    new URL("../app/Game.tsx", import.meta.url),
    "utf8",
  );

  assert.match(html, /og:image/i);
  assert.match(html, /og\.png/i);
  assert.match(gameSource, /praxi-run-v5\/praxi-run-/i);
  assert.match(gameSource, /praxi-idle-v6\.png/i);
  assert.match(gameSource, /praxi-jump-v6\.png/i);
  assert.match(gameSource, /prompt-injection-v2\.png/i);
  assert.match(gameSource, /gameplay-background-l2-v1\.png/i);
  assert.match(gameSource, /sensitive-disclosure-v1\.png/i);
  assert.match(gameSource, /SENSITIVE INFORMATION DISCLOSURE/i);
  assert.match(gameSource, /LLM02/i);
  assert.match(gameSource, /TEN VULNERABILITIES\./i);
  assert.match(gameSource, /ONE HERO\./i);
  assert.match(gameSource, /LEARN THE/i);
  assert.match(gameSource, /OWASP TOP 10/i);
  assert.match(gameSource, /FOR LLMS/i);
  assert.doesNotMatch(gameSource, /title-main-v3\.png/i);
  assert.doesNotMatch(gameSource, /title-sub-1-v3\.png/i);
  assert.doesNotMatch(gameSource, /title-sub-2-v3\.png/i);
  assert.match(gameSource, /github\.com\/open-agent-ai-security\/promptfall/i);
  assert.match(gameSource, /OPEN SOURCE/i);
  assert.match(gameSource, /github-mark\.svg/i);
  assert.match(gameSource, /PRESS SPACE TO START/i);
  assert.match(gameSource, /aria-label="Touch controls"/i);
  assert.match(gameSource, /Move Praxi right and jump on each threat/i);
});

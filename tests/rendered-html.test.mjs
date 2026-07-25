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
  assert.match(html, /social-preview\.jpg/i);
  assert.match(gameSource, /praxi-run-v5\/praxi-run-/i);
  assert.match(gameSource, /praxi-idle-v6\.png/i);
  assert.match(gameSource, /praxi-jump-v6\.png/i);
  assert.match(gameSource, /prompt-injection-v2\.png/i);
  assert.match(gameSource, /enemies-game-v1/i);
  assert.match(gameSource, /gameplay-background-l2-v1\.png/i);
  assert.match(gameSource, /sensitive-disclosure-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l3-v1\.png/i);
  assert.match(gameSource, /excessive-agency-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l4-v1\.png/i);
  assert.match(gameSource, /supply-chain-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l5-v1\.png/i);
  assert.match(gameSource, /data-model-poisoning-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l6-v2\.png/i);
  assert.match(gameSource, /unbounded-consumption-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l7-v2\.png/i);
  assert.match(gameSource, /misinformation-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l8-v1\.png/i);
  assert.match(gameSource, /hidden-context-exposure-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l9-v1\.png/i);
  assert.match(gameSource, /vector-embedding-weaknesses-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l10-v2\.png/i);
  assert.match(gameSource, /improper-output-handling-v1\.png/i);
  assert.match(gameSource, /gameplay-background-l11-gauntlet-v1\.png/i);
  assert.match(gameSource, /THE GAUNTLET/i);
  assert.match(gameSource, /worldWidth: 5390/i);
  assert.match(gameSource, /motion:\s*\{\s*axis:/i);
  assert.match(gameSource, /energyTraps:/i);
  assert.match(gameSource, /llm08-you-drew-me-a-map\.mp3/i);
  assert.match(gameSource, /llm09-close-enough-to-be-dangerous\.mp3/i);
  assert.match(gameSource, /llm10-passed-without-question\.mp3/i);
  assert.match(gameSource, /l11-promptfall-reprise\.mp3/i);
  assert.match(
    gameSource,
    /scene === "winner"[\s\S]*?transitionMusic\(musicForLevel\(levelIndex\)/i,
  );
  assert.match(gameSource, /ALL TEN RISKS CONTAINED/i);
  assert.match(gameSource, /YOUR AGENT/i);
  assert.match(gameSource, /IS SECURE!/i);
  assert.match(gameSource, /campaign-winner/i);
  assert.match(gameSource, /integrity-crate-v1\.png/i);
  assert.match(gameSource, /BONUS_LEVEL_INTERVAL/i);
  assert.match(gameSource, /LEVEL_LAYOUTS/i);
  assert.match(gameSource, /\+1 INTEGRITY!/i);
  assert.match(gameSource, /SENSITIVE INFORMATION DISCLOSURE/i);
  assert.match(gameSource, /LLM02/i);
  assert.match(gameSource, /EXCESSIVE AGENCY/i);
  assert.match(gameSource, /LLM03/i);
  assert.match(gameSource, /SUPPLY CHAIN/i);
  assert.match(gameSource, /LLM04/i);
  assert.match(gameSource, /DATA AND MODEL POISONING/i);
  assert.match(gameSource, /LLM05/i);
  assert.match(gameSource, /UNBOUNDED CONSUMPTION/i);
  assert.match(gameSource, /LLM06/i);
  assert.match(gameSource, /MISINFORMATION/i);
  assert.match(gameSource, /LLM07/i);
  assert.match(gameSource, /HIDDEN CONTEXT EXPOSURE/i);
  assert.match(gameSource, /LLM08/i);
  assert.match(gameSource, /VECTOR AND EMBEDDING WEAKNESSES/i);
  assert.match(gameSource, /LLM09/i);
  assert.match(gameSource, /IMPROPER OUTPUT HANDLING/i);
  assert.match(gameSource, /LLM10/i);
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
  assert.match(gameSource, /GAME OVER/i);
  assert.match(gameSource, /GET PRAXEN/i);
  assert.match(gameSource, /RESTART GAME/i);
  assert.match(gameSource, /FREE AND OPEN SOURCE/i);
  assert.match(gameSource, /open-agent-ai-security\.github\.io\/praxen/i);
  assert.match(gameSource, /praxen-lockup-dark-background\.png/i);
  assert.match(gameSource, /PRESS SPACE TO START/i);
  assert.match(gameSource, /DIRECT LEVEL SELECT/i);
  assert.match(gameSource, /\^F\(\[1-9\]\|1\[01\]\)\$/i);
  assert.match(gameSource, /aria-label="Touch controls: hold the left or right half/i);
  assert.match(gameSource, /TAP WITH SECOND FINGER TO JUMP/i);
  assert.match(gameSource, /pointerType !== "touch"/i);
  assert.match(gameSource, /Move Praxi right and jump on each threat/i);
});

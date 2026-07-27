import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clearControlState,
  createControlState,
  getControlInput,
  isGameplayControlCode,
  pressControlKey,
  releaseControlKey,
  releaseTouchDirection,
  setTouchDirection,
  setTouchJump,
} from "../app/input-state.js";
import {
  FACT_CALLOUT_DISMISS_MS,
  FACT_CALLOUT_GRACE_MS,
  FACT_CALLOUT_TOTAL_MS,
  shouldFastDismissFactCallout,
} from "../app/fact-callout.js";

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

test("keeps gameplay lessons concise and easy to scan", async () => {
  const gameSource = await readFile(
    new URL("../app/Game.tsx", import.meta.url),
    "utf8",
  );
  const lessonBlocks = [
    ...gameSource.matchAll(
      /const [A-Z_]+_LESSONS = \[([\s\S]*?)\] as const;/g,
    ),
  ];
  const lessonTexts = lessonBlocks.flatMap(([, block]) =>
    [...block.matchAll(/text: "([^"]+)"/g)].map(([, text]) => text),
  );

  assert.equal(lessonBlocks.length, 11);
  assert.equal(lessonTexts.length, 70);
  assert.deepEqual(
    lessonTexts.filter((text) => text.trim().split(/\s+/).length > 20),
    [],
  );
  assert.doesNotMatch(lessonTexts.join("\n"), /—/);
});

test("keeps simultaneous keyboard controls independent", () => {
  const controls = createControlState();
  pressControlKey(controls, "ArrowRight");
  pressControlKey(controls, "KeyD");
  releaseControlKey(controls, "ArrowRight");

  assert.deepEqual(getControlInput(controls), {
    left: false,
    right: true,
    jump: false,
  });

  releaseControlKey(controls, "KeyD");
  assert.equal(getControlInput(controls).right, false);
});

test("combines keyboard and touch without either source erasing the other", () => {
  const controls = createControlState();
  pressControlKey(controls, "KeyD");
  setTouchDirection(controls, 17, "right");
  releaseTouchDirection(controls, 17);
  assert.equal(getControlInput(controls).right, true);

  setTouchDirection(controls, 18, "left");
  releaseControlKey(controls, "KeyD");
  assert.deepEqual(getControlInput(controls), {
    left: true,
    right: false,
    jump: false,
  });
});

test("clears interrupted controls and recognizes Space as gameplay input", () => {
  const controls = createControlState();
  pressControlKey(controls, "ArrowRight");
  setTouchDirection(controls, 7, "right");
  setTouchJump(controls, true);
  clearControlState(controls);

  assert.deepEqual(getControlInput(controls), {
    left: false,
    right: false,
    jump: false,
  });
  assert.equal(isGameplayControlCode("Space"), true);
  assert.equal(isGameplayControlCode(" "), false);
});

test("keeps a directional hold active throughout a second-finger jump", () => {
  const controls = createControlState();
  setTouchDirection(controls, 1, "right");
  setTouchJump(controls, true);
  assert.deepEqual(getControlInput(controls), {
    left: false,
    right: true,
    jump: true,
  });

  setTouchJump(controls, false);
  assert.deepEqual(getControlInput(controls), {
    left: false,
    right: true,
    jump: false,
  });
});

test("holds learning callouts unless gameplay resumes after the grace period", () => {
  const idle = { left: false, right: false, jump: false };
  const moving = { left: false, right: true, jump: false };

  assert.equal(FACT_CALLOUT_GRACE_MS, 2_000);
  assert.equal(FACT_CALLOUT_TOTAL_MS, 8_100);
  assert.equal(FACT_CALLOUT_DISMISS_MS, 1_000);
  assert.equal(shouldFastDismissFactCallout(1_999, moving), false);
  assert.equal(shouldFastDismissFactCallout(2_000, idle), false);
  assert.equal(shouldFastDismissFactCallout(2_000, moving), true);
  assert.equal(
    shouldFastDismissFactCallout(4_000, {
      left: false,
      right: false,
      jump: true,
    }),
    true,
  );
});

test("ships community pageview counters without gameplay telemetry", async () => {
  const response = await render();
  const html = await response.text();
  const staticEntry = await readFile(
    new URL("../static/index.html", import.meta.url),
    "utf8",
  );
  const counterClient = await readFile(
    new URL("../public/assets/count.js", import.meta.url),
    "utf8",
  );
  const gameSource = await readFile(
    new URL("../app/Game.tsx", import.meta.url),
    "utf8",
  );

  for (const entry of [html, staticEntry]) {
    assert.match(
      entry,
      /open-agent-ai-security\.goatcounter\.com\/count/i,
    );
    assert.match(entry, /assets\/count\.js/i);
    assert.match(entry, /static\.cloudflareinsights\.com\/beacon\.min\.js/i);
    assert.match(entry, /data-cf-beacon/i);
  }

  assert.match(counterClient, /ISC License/i);
  assert.doesNotMatch(gameSource, /goatcounter|cloudflareinsights/i);
});

test("ships social metadata and accessible controls", async () => {
  const response = await render();
  const html = await response.text();
  const gameSource = await readFile(
    new URL("../app/Game.tsx", import.meta.url),
    "utf8",
  );
  const musicHealthSource = await readFile(
    new URL("../app/music-health.js", import.meta.url),
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
  assert.match(gameSource, /\(\?:Digit\|Numpad\)/i);
  assert.match(gameSource, /event\.code === "KeyG"/i);
  assert.doesNotMatch(gameSource, /\^F\(\[1-9\]/i);
  assert.match(gameSource, /worldWidth: 6000/i);
  assert.equal(
    [...gameSource.matchAll(/worldWidth: 3700/g)].length,
    4,
  );
  assert.match(gameSource, /worldWidth: 3850/i);
  assert.equal(
    [...gameSource.matchAll(/energyTraps:/g)].length,
    4,
  );
  assert.match(gameSource, /motion:\s*\{\s*axis:/i);
  assert.match(gameSource, /ridingPlatformIndex/i);
  assert.match(gameSource, /energyTraps:/i);
  assert.match(gameSource, /llm08-you-drew-me-a-map\.mp3/i);
  assert.match(gameSource, /llm09-close-enough-to-be-dangerous\.mp3/i);
  assert.match(gameSource, /llm10-passed-without-question\.mp3/i);
  assert.match(gameSource, /l11-promptfall-reprise\.mp3/i);
  assert.match(gameSource, /inactiveAudio\.muted = true/i);
  assert.match(musicHealthSource, /audio\.muted = false/i);
  assert.match(musicHealthSource, /"stalled"/i);
  assert.match(musicHealthSource, /"ended"/i);
  assert.match(musicHealthSource, /MUSIC_STALL_THRESHOLD_MS/i);
  assert.doesNotMatch(gameSource, /musicPrimedRef/i);
  assert.match(gameSource, /sfx-next-level\.mp3/i);
  assert.match(gameSource, /sfx-player-hit\.mp3/i);
  assert.match(gameSource, /PLAYER_INVULNERABILITY_SECONDS = 1\.8/i);
  assert.match(gameSource, /sfx-level-complete\.mp3/i);
  assert.match(gameSource, /sfx-laser\.mp3/i);
  assert.match(gameSource, /sfx-gameover\.mp3/i);
  assert.match(gameSource, /sfx-powerup\.mp3/i);
  assert.match(gameSource, /sfx-enemy-hit\.mp3/i);
  assert.match(gameSource, /sfx-jump\.mp3/i);
  assert.match(gameSource, /SOUND TRACK:/i);
  assert.match(gameSource, /currentLevel\.riskCode/i);
  assert.doesNotMatch(gameSource, /className="objective"/i);
  assert.match(gameSource, /formatLessonKind\(factLesson\.kind\)/i);
  assert.doesNotMatch(gameSource, /createOscillator|playTone/i);
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
  assert.match(gameSource, /TAP FOR NEXT LEVEL/i);
  assert.match(gameSource, /TAP FOR TITLE/i);
  assert.match(gameSource, /HOW TO PLAY/i);
  assert.match(gameSource, /MISSION BRIEFING/i);
  assert.match(gameSource, /MEET PRAXI/i);
  assert.match(gameSource, /instructions-tail-generator/i);
  assert.match(gameSource, /instruction-control-line/i);
  assert.match(gameSource, /LEARNING TIPS/i);
  assert.match(gameSource, /instruction-number">05/i);
  assert.match(gameSource, /Listen for insights/i);
  assert.match(gameSource, /PRESS ANY KEY TO RETURN/i);
  assert.match(gameSource, /TRAINING CODES \/\/ SKIP AHEAD/i);
  assert.match(gameSource, /event\.code === "KeyH"/i);
  assert.match(gameSource, /scene === "title" \|\| scene === "instructions"/i);
  assert.match(gameSource, /DIRECT LEVEL SELECT/i);
  assert.match(gameSource, /1–9 \/ 0 \/ G/i);
  assert.match(gameSource, /aria-label="Touch controls: hold the left or right half/i);
  assert.match(gameSource, /TAP OTHER SIDE TO JUMP/i);
  assert.match(gameSource, /pointerType !== "touch"/i);
  assert.match(gameSource, /onLostPointerCapture/i);
  assert.match(gameSource, /visibilitychange/i);
  assert.match(gameSource, /pagehide/i);
  assert.match(gameSource, /releaseAllInputs/i);
  assert.match(gameSource, /event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/i);
  assert.match(gameSource, /Move Praxi right and jump on each threat/i);
});

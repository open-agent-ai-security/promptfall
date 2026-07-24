"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Scene =
  | "splash"
  | "title"
  | "levelIntro"
  | "playing"
  | "complete"
  | "gameOver"
  | "praxenAd";

type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: "floor" | "ledge";
};

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  grounded: boolean;
  facing: 1 | -1;
  invulnerable: number;
  runClock: number;
};

type Enemy = {
  lessonIndex: number;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  active: boolean;
  pulse: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

type GameArt = {
  backgrounds?: HTMLImageElement[];
  runFrames?: HTMLImageElement[];
  ready?: HTMLImageElement;
  jump?: HTMLImageElement;
  enemies?: HTMLImageElement[];
};

const VIEW_W = 1280;
const VIEW_H = 720;
const WORLD_W = 3080;
const EXIT_FIELD_X = 2860;
const EXIT_FIELD_LEFT = EXIT_FIELD_X - 62;
const GRAVITY = 2200;
const MOVE_SPEED = 365;
const JUMP_SPEED = 820;

const PLATFORMS: Platform[] = [
  { x: 0, y: 606, w: 620, h: 114, kind: "floor" },
  { x: 680, y: 606, w: 510, h: 114, kind: "floor" },
  { x: 1240, y: 606, w: 640, h: 114, kind: "floor" },
  { x: 1930, y: 606, w: 520, h: 114, kind: "floor" },
  { x: 2500, y: 606, w: 580, h: 114, kind: "floor" },
  { x: 430, y: 474, w: 230, h: 24, kind: "ledge" },
  { x: 890, y: 420, w: 250, h: 24, kind: "ledge" },
  { x: 1390, y: 490, w: 230, h: 24, kind: "ledge" },
  { x: 1690, y: 368, w: 250, h: 24, kind: "ledge" },
  { x: 2180, y: 464, w: 220, h: 24, kind: "ledge" },
  { x: 2580, y: 402, w: 260, h: 24, kind: "ledge" },
];

const PROMPT_INJECTION_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Prompt injection happens when input changes an LLM's behavior in ways its developer did not intend.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "LLMs process instructions and data as one token stream—there is no clean trust boundary between them.",
  },
  {
    kind: "EXAMPLE 1",
    text: "A user tells a support bot to ignore its rules, query private data, and send email.",
  },
  {
    kind: "EXAMPLE 2",
    text: "Hidden instructions in a web page can make an assistant leak private context through an image URL.",
  },
  {
    kind: "DEFENSE 1",
    text: "Keep credentials and state-changing powers in application code, and grant least privilege per operation.",
  },
  {
    kind: "DEFENSE 2",
    text: "Require explicit human approval before privileged, irreversible, or externally visible actions.",
  },
] as const;

const SENSITIVE_INFORMATION_DISCLOSURE_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Sensitive information disclosure happens when an LLM system exposes protected data through any channel the owner did not authorize.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Judge a leak by what the recipient can learn—not whether it appeared in a normal answer. Traces, logs, embeddings, timing, and tool calls can all disclose.",
  },
  {
    kind: "EXAMPLE 1",
    text: "A sanitized answer can still leak PII when raw reasoning traces and retrieved chunks are copied into shared observability logs.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A leaked “embeddings-only” backup can be inverted to reconstruct source text, turning vectors into a document breach.",
  },
  {
    kind: "DEFENSE 1",
    text: "Authorize documents and chunks before retrieval, isolate sensitive tenants, and send the model only task-required fields.",
  },
  {
    kind: "DEFENSE 2",
    text: "Classify and redact every output channel—including traces, logs, tool arguments, and multimodal data—before it leaves the trusted boundary.",
  },
] as const;

const EXCESSIVE_AGENCY_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Excessive agency lets unexpected, ambiguous, or manipulated model output trigger damaging actions through too much functionality, permission, or autonomy.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Agent safety is not only about what a model intends—it is about what the system allows it to do when the model is wrong.",
  },
  {
    kind: "EXAMPLE 1",
    text: "A mailbox assistant only needs to read email, but its tool can also send messages; an injected email tricks it into forwarding private data.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A read-only database tool connects with UPDATE, INSERT, and DELETE rights, turning one bad decision into damaged records.",
  },
  {
    kind: "DEFENSE 1",
    text: "Offer only the minimum granular tools and functions required. Avoid open-ended tools, enforce strict schemas, and validate every argument.",
  },
  {
    kind: "DEFENSE 2",
    text: "Use least privilege and the user's own security context; independently authorize every action and require approval for high-impact changes.",
  },
] as const;

const LEVELS = [
  {
    number: 1,
    riskCode: "LLM01",
    name: "PROMPT INJECTION",
    objectiveName: "Prompt Injection",
    background: "./assets/gameplay-background-v2.png",
    enemy: "./assets/prompt-injection-v2.png",
    lessons: PROMPT_INJECTION_LESSONS,
  },
  {
    number: 2,
    riskCode: "LLM02",
    name: "SENSITIVE INFORMATION DISCLOSURE",
    objectiveName: "Sensitive Information Disclosure",
    background: "./assets/gameplay-background-l2-v1.png",
    enemy: "./assets/sensitive-disclosure-v1.png",
    lessons: SENSITIVE_INFORMATION_DISCLOSURE_LESSONS,
  },
  {
    number: 3,
    riskCode: "LLM03",
    name: "EXCESSIVE AGENCY",
    objectiveName: "Excessive Agency",
    background: "./assets/gameplay-background-l3-v1.png",
    enemy: "./assets/excessive-agency-v1.png",
    lessons: EXCESSIVE_AGENCY_LESSONS,
  },
] as const;

const createEnemies = (): Enemy[] => [
  {
    lessonIndex: 0,
    x: 735,
    y: 540,
    vx: 72,
    w: 66,
    h: 66,
    minX: 700,
    maxX: 820,
    active: true,
    pulse: 0,
  },
  {
    lessonIndex: 1,
    x: 990,
    y: 354,
    vx: -78,
    w: 66,
    h: 66,
    minX: 915,
    maxX: 1055,
    active: true,
    pulse: 0.7,
  },
  {
    lessonIndex: 2,
    x: 1470,
    y: 424,
    vx: 82,
    w: 66,
    h: 66,
    minX: 1410,
    maxX: 1540,
    active: true,
    pulse: 1.4,
  },
  {
    lessonIndex: 3,
    x: 1770,
    y: 302,
    vx: -74,
    w: 66,
    h: 66,
    minX: 1715,
    maxX: 1850,
    active: true,
    pulse: 2.1,
  },
  {
    lessonIndex: 4,
    x: 2240,
    y: 398,
    vx: 78,
    w: 66,
    h: 66,
    minX: 2195,
    maxX: 2310,
    active: true,
    pulse: 2.8,
  },
  {
    lessonIndex: 5,
    x: 2670,
    y: 336,
    vx: -80,
    w: 66,
    h: 66,
    minX: 2600,
    maxX: 2750,
    active: true,
    pulse: 3.5,
  },
];

const stars = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 173 + 41) % VIEW_W,
  y: 38 + ((i * 97) % 360),
  r: 0.5 + ((i * 7) % 15) / 10,
  a: 0.18 + ((i * 13) % 50) / 100,
}));

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  backgroundImage?: HTMLImageElement,
) {
  if (backgroundImage?.complete && backgroundImage.naturalWidth > 0) {
    const parallax = Math.min(190, cameraX * 0.065);
    ctx.drawImage(backgroundImage, -parallax, -48, 1470, 828);
    const bloom = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    bloom.addColorStop(0, "rgba(2, 7, 18, .04)");
    bloom.addColorStop(0.62, "rgba(2, 7, 18, .08)");
    bloom.addColorStop(1, "rgba(2, 7, 18, .7)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#040712");
  sky.addColorStop(0.52, "#07162a");
  sky.addColorStop(1, "#06101c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const glow = ctx.createRadialGradient(
    VIEW_W * 0.73,
    250,
    10,
    VIEW_W * 0.73,
    250,
    560,
  );
  glow.addColorStop(0, "rgba(16, 181, 255, .14)");
  glow.addColorStop(0.45, "rgba(19, 104, 194, .055)");
  glow.addColorStop(1, "rgba(4, 7, 18, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  for (const star of stars) {
    const sx = ((star.x - cameraX * 0.035) % VIEW_W + VIEW_W) % VIEW_W;
    circle(ctx, sx, star.y, star.r, `rgba(139,225,255,${star.a})`);
  }

  ctx.save();
  ctx.translate(-(cameraX * 0.11) % 260, 0);
  for (let x = -260; x < VIEW_W + 300; x += 130) {
    const h = 80 + ((x / 10) % 7) * 12;
    ctx.fillStyle = "rgba(9, 30, 52, .65)";
    ctx.fillRect(x, 448 - h, 78, h);
    ctx.strokeStyle = "rgba(35, 178, 236, .12)";
    ctx.strokeRect(x, 448 - h, 78, h);
    for (let wy = 385 - h; wy < 432; wy += 24) {
      ctx.fillStyle = "rgba(28, 201, 255, .12)";
      ctx.fillRect(x + 14, wy, 8, 2);
      ctx.fillRect(x + 38, wy, 20, 2);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = "#24c8ff";
  ctx.lineWidth = 1;
  const gridOffset = -(cameraX * 0.24) % 80;
  for (let x = gridOffset; x < VIEW_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2, 416);
    ctx.lineTo(x, VIEW_H);
    ctx.stroke();
  }
  for (let y = 438; y < VIEW_H; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(4, 11, 20, .76)";
  ctx.fillRect(0, 540, VIEW_W, 180);
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  cameraX: number,
) {
  const x = platform.x - cameraX;
  if (x > VIEW_W + 80 || x + platform.w < -80) return;

  const topGlow = ctx.createLinearGradient(x, platform.y, x, platform.y + 30);
  topGlow.addColorStop(0, "rgba(69, 220, 255, .7)");
  topGlow.addColorStop(0.1, "#182f42");
  topGlow.addColorStop(1, "#08131f");
  ctx.fillStyle = topGlow;
  roundedRect(ctx, x, platform.y, platform.w, platform.h, 6);
  ctx.fill();

  ctx.strokeStyle = "rgba(58, 221, 255, .65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 9, platform.y + 1);
  ctx.lineTo(x + platform.w - 9, platform.y + 1);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 151, 28, .34)";
  ctx.lineWidth = 2;
  for (let px = x + 28; px < x + platform.w - 24; px += 92) {
    ctx.beginPath();
    ctx.moveTo(px, platform.y + 11);
    ctx.lineTo(px + 24, platform.y + 11);
    ctx.lineTo(px + 32, platform.y + 19);
    ctx.lineTo(px + 54, platform.y + 19);
    ctx.stroke();
  }

  if (platform.kind === "floor") {
    ctx.fillStyle = "rgba(0, 0, 0, .16)";
    for (let px = x + 20; px < x + platform.w; px += 64) {
      ctx.beginPath();
      ctx.moveTo(px, platform.y + 36);
      ctx.lineTo(px + 20, platform.y + 76);
      ctx.lineTo(px + 34, platform.y + 76);
      ctx.lineTo(px + 14, platform.y + 36);
      ctx.fill();
    }
  }
}

function drawPraxi(
  ctx: CanvasRenderingContext2D,
  player: Player,
  cameraX: number,
  runFrames?: HTMLImageElement[],
  readySprite?: HTMLImageElement,
  jumpSprite?: HTMLImageElement,
) {
  const x = player.x - cameraX + player.w / 2;
  const alpha =
    player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0
      ? 0.35
      : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, player.y + player.h);
  ctx.scale(player.facing, 1);
  ctx.shadowColor = "rgba(255, 139, 24, .48)";
  ctx.shadowBlur = 16;

  if (!player.grounded && jumpSprite?.complete && jumpSprite.naturalWidth > 0) {
    ctx.drawImage(jumpSprite, -100, -188, 200, 200);
  } else if (Math.abs(player.vx) > 22 && runFrames?.length) {
    const frame = runFrames[Math.floor(player.runClock * 12) % runFrames.length];
    if (frame.complete && frame.naturalWidth > 0) {
      ctx.drawImage(frame, -100, -188, 200, 200);
    }
  } else if (readySprite?.complete && readySprite.naturalWidth > 0) {
    const breath = (Math.sin(player.runClock * 3.2) + 1) * 0.006;
    ctx.scale(1 - breath * 0.35, 1 + breath);
    ctx.drawImage(readySprite, -100, -188, 200, 200);
  } else if (runFrames?.[0]?.complete) {
    ctx.drawImage(runFrames[0], -100, -188, 200, 200);
  }
  ctx.restore();
}

function drawPromptInjection(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  cameraX: number,
  sprite?: HTMLImageElement,
) {
  if (!enemy.active) return;
  const x = enemy.x - cameraX + enemy.w / 2;
  const y = enemy.y + enemy.h / 2;
  const pulse = 1 + Math.sin(enemy.pulse * 5) * 0.06;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#ff2a74";
  ctx.shadowBlur = 24;
  if (sprite?.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -76, -56, 152, 101);
  } else {
    ctx.fillStyle = "#ff315f";
    roundedRect(ctx, -29, -23, 58, 46, 9);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawCapture(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  cameraX: number,
  captureTime: number,
) {
  if (enemy.active || captureTime <= 0) return;
  const x = enemy.x - cameraX + enemy.w / 2;
  const y = enemy.y + enemy.h / 2;
  const progress = Math.min(1, (0.9 - captureTime) / 0.9);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = "#36d8ff";
  ctx.shadowBlur = 24;
  for (let ring = 0; ring < 3; ring++) {
    ctx.strokeStyle = ring === 1 ? "#ff9d28" : "#4ae4ff";
    ctx.lineWidth = Math.max(1, 5 - progress * 3 - ring);
    ctx.beginPath();
    ctx.arc(0, 0, 22 + progress * (78 + ring * 24), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(progress * 0.8);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, 4 - progress * 3);
  ctx.beginPath();
  ctx.moveTo(-58 - progress * 35, 0);
  ctx.lineTo(58 + progress * 35, 0);
  ctx.moveTo(0, -58 - progress * 35);
  ctx.lineTo(0, 58 + progress * 35);
  ctx.stroke();
  ctx.restore();
}

function drawExitGate(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  remaining: number,
  time: number,
  unlockProgress: number,
) {
  const x = EXIT_FIELD_X - cameraX;
  if (x < -160 || x > VIEW_W + 160) return;
  const unlocked = remaining === 0;
  const retract = unlocked
    ? 1 - Math.pow(1 - Math.max(0, Math.min(1, unlockProgress)), 3)
    : 0;
  const pulse = (Math.sin(time * 5) + 1) / 2;
  const fieldTop = 0;
  const fieldBottom = VIEW_H;
  const halfWidth = 54;

  ctx.save();
  ctx.translate(x, 0);

  // Ceiling and floor emitters make this read as a wall, not a doorway.
  ctx.shadowColor = unlocked ? "#52e8ff" : "#ff477f";
  ctx.shadowBlur = 18 + pulse * 8;
  for (const edge of [fieldTop - 5, fieldBottom - 20]) {
    const emitter = ctx.createLinearGradient(-halfWidth - 18, 0, halfWidth + 18, 0);
    emitter.addColorStop(0, "#071526");
    emitter.addColorStop(0.24, unlocked ? "#25dff6" : "#ff386f");
    emitter.addColorStop(0.5, "#e9fdff");
    emitter.addColorStop(0.76, unlocked ? "#25dff6" : "#ff386f");
    emitter.addColorStop(1, "#071526");
    ctx.fillStyle = emitter;
    roundedRect(ctx, -halfWidth - 18, edge, halfWidth * 2 + 36, 25, 7);
    ctx.fill();
    ctx.strokeStyle = unlocked ? "#93f4ff" : "#ff9cbd";
    ctx.lineWidth = 2;
    roundedRect(ctx, -halfWidth - 18, edge, halfWidth * 2 + 36, 25, 7);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  if (!unlocked || retract < 1) {
    // The wall splits at center and retracts into the ceiling and floor.
    const activeHalfHeight = (fieldBottom / 2) * (1 - retract);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-halfWidth, fieldTop, halfWidth * 2, activeHalfHeight);
    ctx.rect(
      -halfWidth,
      fieldBottom - activeHalfHeight,
      halfWidth * 2,
      activeHalfHeight,
    );
    ctx.clip();

    const barrier = ctx.createLinearGradient(-halfWidth, 0, halfWidth, 0);
    barrier.addColorStop(0, "rgba(255,55,116,.76)");
    barrier.addColorStop(0.35, "rgba(65,222,255,.32)");
    barrier.addColorStop(0.5, `rgba(255,255,255,${0.34 + pulse * 0.22})`);
    barrier.addColorStop(0.65, "rgba(65,222,255,.32)");
    barrier.addColorStop(1, "rgba(255,55,116,.76)");
    ctx.fillStyle = barrier;
    ctx.fillRect(-halfWidth, fieldTop, halfWidth * 2, fieldBottom);

    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = "#7cecff";
    ctx.shadowBlur = 12;
    for (let i = 0; i < 7; i++) {
      const waveX =
        -45 +
        i * 15 +
        Math.sin(time * (3.2 + i * 0.08) + i * 1.7) * 8;
      ctx.strokeStyle =
        i % 2 ? "rgba(91,232,255,.76)" : "rgba(255,91,142,.72)";
      ctx.lineWidth = 1.5 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(waveX, fieldTop);
      for (let py = fieldTop; py <= fieldBottom; py += 18) {
        ctx.lineTo(
          waveX + Math.sin(py * 0.055 + time * 6 + i) * 9,
          py,
        );
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(220,252,255,.34)";
    ctx.lineWidth = 1;
    const scanOffset = (time * 74) % 24;
    for (let py = fieldTop + scanOffset; py < fieldBottom; py += 24) {
      ctx.beginPath();
      ctx.moveTo(-halfWidth, py);
      ctx.lineTo(halfWidth, py);
      ctx.stroke();
    }
    ctx.restore();

    if (unlocked) {
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = `rgba(240,255,255,${0.72 + pulse * 0.24})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "#74efff";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(-halfWidth, activeHalfHeight);
      ctx.lineTo(halfWidth, activeHalfHeight);
      ctx.moveTo(-halfWidth, fieldBottom - activeHalfHeight);
      ctx.lineTo(halfWidth, fieldBottom - activeHalfHeight);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  if (unlocked) {
    // Residual energy gathers at the emitters as the passage opens.
    ctx.globalAlpha = Math.max(0.12, retract);
    ctx.globalCompositeOperation = "screen";
    for (const edge of [fieldTop, fieldBottom]) {
      const topEdge = edge === fieldTop;
      const edgeGlow = ctx.createLinearGradient(
        0,
        topEdge ? fieldTop : fieldBottom - 90,
        0,
        topEdge ? fieldTop + 90 : fieldBottom,
      );
      edgeGlow.addColorStop(topEdge ? 0 : 1, `rgba(92,236,255,${0.58 + pulse * 0.3})`);
      edgeGlow.addColorStop(topEdge ? 1 : 0, "rgba(45,224,255,0)");
      ctx.fillStyle = edgeGlow;
      ctx.fillRect(
        -halfWidth,
        topEdge ? fieldTop : fieldBottom - 90,
        halfWidth * 2,
        90,
      );
    }
    for (let i = 0; i < 12; i++) {
      const fromTop = i % 2 === 0;
      const travel = (i * 29 + time * (28 + i)) % 82;
      const sparkY = fromTop ? 18 + travel : fieldBottom - 18 - travel;
      circle(
        ctx,
        -halfWidth + 10 + ((i * 31) % (halfWidth * 2 - 20)),
        sparkY,
        1.5 + (i % 3),
        i % 3 ? "#5ceaff" : "#fff4a3",
      );
    }
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.textAlign = "center";
  ctx.fillStyle = unlocked ? "#d8fbff" : "#ffd1df";
  ctx.font = "italic 900 17px Impact, 'Arial Black', sans-serif";
  ctx.shadowColor = unlocked ? "#38dcff" : "#ff3f79";
  ctx.shadowBlur = 12;
  ctx.fillText(
    !unlocked
      ? "FORCE FIELD"
      : retract < 1
        ? "FIELD RETRACTING"
        : "FIELD OPEN",
    0,
    54,
  );
  ctx.font = "900 11px Arial, sans-serif";
  ctx.fillStyle = unlocked ? "#9bf3ff" : "#ffb1ca";
  ctx.fillText(
    !unlocked
      ? `${remaining} THREATS REMAIN`
      : retract < 1
        ? "STAND CLEAR"
        : "PASS THROUGH",
    0,
    74,
  );
  ctx.restore();
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const factRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<GameArt>({});
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const sceneRef = useRef<Scene>("splash");
  const levelIndexRef = useRef(0);
  const inputRef = useRef({ left: false, right: false, jump: false });
  const jumpLatchRef = useRef(false);
  const playerRef = useRef<Player>({
    x: 150,
    y: 516,
    vx: 0,
    vy: 0,
    w: 70,
    h: 90,
    grounded: true,
    facing: 1,
    invulnerable: 0,
    runClock: 0,
  });
  const enemiesRef = useRef<Enemy[]>(createEnemies());
  const capturedEnemyRef = useRef<Enemy | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const cameraRef = useRef(0);
  const captureTimeRef = useRef(0);
  const fieldUnlockStartedRef = useRef<number | null>(null);
  const factTimerRef = useRef<number | null>(null);
  const [scene, setScene] = useState<Scene>("splash");
  const [levelIndex, setLevelIndex] = useState(0);
  const [health, setHealth] = useState(3);
  const healthRef = useRef(3);
  const [captured, setCaptured] = useState(0);
  const [callout, setCallout] = useState(false);
  const [factLessonIndex, setFactLessonIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playTone = useCallback(
    (frequency: number, duration: number, type: OscillatorType = "sine") => {
      if (mutedRef.current || typeof window === "undefined") return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!AudioCtx) return;
        const audio = audioContextRef.current ?? new AudioCtx();
        audioContextRef.current = audio;
        if (audio.state === "suspended") {
          void audio.resume();
        }
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const startAt = audio.currentTime + 0.01;
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.015);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          startAt + duration,
        );
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration);
        oscillator.addEventListener("ended", () => {
          oscillator.disconnect();
          gain.disconnect();
        });
      } catch {
        // Audio is enhancement-only.
      }
    },
    [],
  );

  const triggerGameOver = useCallback(() => {
    if (sceneRef.current !== "playing") return;
    inputRef.current = { left: false, right: false, jump: false };
    setCallout(false);
    if (factTimerRef.current !== null) {
      window.clearTimeout(factTimerRef.current);
      factTimerRef.current = null;
    }
    sceneRef.current = "gameOver";
    setScene("gameOver");
    playTone(92, 0.42, "sawtooth");
  }, [playTone]);

  const resetGame = useCallback(() => {
    if (factTimerRef.current !== null) {
      window.clearTimeout(factTimerRef.current);
      factTimerRef.current = null;
    }
    inputRef.current = { left: false, right: false, jump: false };
    jumpLatchRef.current = false;
    playerRef.current = {
      x: 150,
      y: 516,
      vx: 0,
      vy: 0,
      w: 70,
      h: 90,
      grounded: true,
      facing: 1,
      invulnerable: 0,
      runClock: 0,
    };
    enemiesRef.current = createEnemies();
    capturedEnemyRef.current = null;
    particlesRef.current = [];
    cameraRef.current = 0;
    captureTimeRef.current = 0;
    fieldUnlockStartedRef.current = null;
    healthRef.current = 3;
    setHealth(3);
    setCaptured(0);
    setCallout(false);
    setFactLessonIndex(0);
  }, []);

  const startLevel = useCallback((nextLevelIndex: number) => {
    resetGame();
    levelIndexRef.current = nextLevelIndex;
    setLevelIndex(nextLevelIndex);
    sceneRef.current = "levelIntro";
    setScene("levelIntro");
    playTone(220, 0.12, "square");
  }, [playTone, resetGame]);

  const startCampaign = useCallback(() => {
    startLevel(0);
  }, [startLevel]);

  const advanceCampaign = useCallback(() => {
    const nextLevelIndex = levelIndexRef.current + 1;
    if (nextLevelIndex < LEVELS.length) {
      startLevel(nextLevelIndex);
      return;
    }
    resetGame();
    levelIndexRef.current = 0;
    setLevelIndex(0);
    sceneRef.current = "title";
    setScene("title");
  }, [resetGame, startLevel]);

  const setInput = useCallback(
    (key: "left" | "right" | "jump", active: boolean) => {
      inputRef.current[key] = active;
    },
    [],
  );

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    const load = (src: string) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      return image;
    };
    artRef.current = {
      backgrounds: LEVELS.map((level) => load(level.background)),
      runFrames: Array.from({ length: 7 }, (_, frame) =>
        load(`./assets/praxi-run-v5/praxi-run-${frame}.png`),
      ),
      ready: load("./assets/praxi-idle-v6.png"),
      jump: load("./assets/praxi-jump-v6.png"),
      enemies: LEVELS.map((level) => load(level.enemy)),
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(
    () => () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    },
    [],
  );

  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      if (sceneRef.current === "splash") {
        sceneRef.current = "title";
        setScene("title");
      }
    }, 4200);
    return () => window.clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (scene !== "levelIntro") return;

    const secondBeat = window.setTimeout(
      () => playTone(275, 0.1, "square"),
      720,
    );
    const thirdBeat = window.setTimeout(
      () => playTone(330, 0.12, "square"),
      1440,
    );
    const goBeat = window.setTimeout(
      () => playTone(760, 0.18, "triangle"),
      2320,
    );
    const beginLevel = window.setTimeout(() => {
      sceneRef.current = "playing";
      setScene("playing");
    }, 3400);

    return () => {
      window.clearTimeout(secondBeat);
      window.clearTimeout(thirdBeat);
      window.clearTimeout(goBeat);
      window.clearTimeout(beginLevel);
    };
  }, [playTone, scene]);

  useEffect(() => {
    if (scene !== "gameOver") return;

    const pulseOne = window.setTimeout(
      () => playTone(132, 0.16, "square"),
      900,
    );
    const pulseTwo = window.setTimeout(
      () => playTone(116, 0.16, "square"),
      1510,
    );
    const pulseThree = window.setTimeout(
      () => playTone(98, 0.22, "square"),
      2120,
    );
    const showPraxen = window.setTimeout(() => {
      sceneRef.current = "praxenAd";
      setScene("praxenAd");
      playTone(310, 0.18, "triangle");
      window.setTimeout(() => playTone(465, 0.22, "sine"), 120);
    }, 3450);

    return () => {
      window.clearTimeout(pulseOne);
      window.clearTimeout(pulseTwo);
      window.clearTimeout(pulseThree);
      window.clearTimeout(showPraxen);
    };
  }, [playTone, scene]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", " ", "KeyA", "KeyD", "KeyW"].includes(
          event.code,
        )
      ) {
        event.preventDefault();
      }
      if (
        sceneRef.current === "title" &&
        (event.code === "Space" || event.code === "Enter")
      ) {
        startCampaign();
        return;
      }
      if (
        sceneRef.current === "complete" &&
        (event.code === "Space" || event.code === "Enter")
      ) {
        advanceCampaign();
        return;
      }
      if (
        sceneRef.current === "praxenAd" &&
        (event.code === "Space" || event.code === "Enter") &&
        !(
          event.target instanceof Element &&
          event.target.closest("a, button")
        )
      ) {
        event.preventDefault();
        startCampaign();
        return;
      }
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        inputRef.current.left = true;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        inputRef.current.right = true;
      }
      if (
        event.code === "ArrowUp" ||
        event.code === "KeyW" ||
        event.code === "Space"
      ) {
        inputRef.current.jump = true;
      }
      if (event.code === "KeyM") setMuted((value) => !value);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        inputRef.current.left = false;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        inputRef.current.right = false;
      }
      if (
        event.code === "ArrowUp" ||
        event.code === "KeyW" ||
        event.code === "Space"
      ) {
        inputRef.current.jump = false;
      }
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [advanceCampaign, startCampaign, startLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (now: number) => {
      const rawDt = lastTimeRef.current
        ? (now - lastTimeRef.current) / 1000
        : 0;
      const dt = Math.min(rawDt, 1 / 30);
      lastTimeRef.current = now;

      const player = playerRef.current;
      const enemies = enemiesRef.current;
      const activeLevel = LEVELS[levelIndexRef.current];
      if (sceneRef.current === "playing") {
        const input = inputRef.current;
        const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        player.vx += (axis * MOVE_SPEED - player.vx) * Math.min(1, dt * 10);
        if (axis === 0) player.vx *= Math.pow(0.0008, dt);
        if (axis !== 0) player.facing = axis > 0 ? 1 : -1;

        if (input.jump && !jumpLatchRef.current && player.grounded) {
          player.vy = -JUMP_SPEED;
          player.grounded = false;
          jumpLatchRef.current = true;
          playTone(520, 0.11, "square");
        }
        if (!input.jump) jumpLatchRef.current = false;
        if (!input.jump && player.vy < -260) player.vy *= Math.pow(0.018, dt);

        const previousY = player.y;
        player.vy += GRAVITY * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x));
        player.grounded = false;

        for (const platform of PLATFORMS) {
          const wasAbove = previousY + player.h <= platform.y + 8;
          const crossesTop =
            player.y + player.h >= platform.y &&
            player.y + player.h <= platform.y + 28 + Math.max(0, player.vy * dt);
          const overlapsX =
            player.x + player.w > platform.x + 6 &&
            player.x < platform.x + platform.w - 6;
          if (wasAbove && crossesTop && overlapsX && player.vy >= 0) {
            player.y = platform.y - player.h;
            player.vy = 0;
            player.grounded = true;
          }
        }

        if (player.y > VIEW_H + 180) {
          player.x = Math.max(80, cameraRef.current + 100);
          player.y = 440;
          player.vy = -320;
          healthRef.current = Math.max(0, healthRef.current - 1);
          setHealth(healthRef.current);
          playTone(110, 0.25, "sawtooth");
          if (healthRef.current <= 0) {
            triggerGameOver();
          }
        }

        player.invulnerable = Math.max(0, player.invulnerable - dt);
        player.runClock += dt;

        for (const enemy of enemies) {
          if (sceneRef.current !== "playing") break;
          if (!enemy.active) continue;

          enemy.x += enemy.vx * dt;
          if (enemy.x < enemy.minX || enemy.x > enemy.maxX) {
            enemy.vx *= -1;
            enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX, enemy.x));
          }
          enemy.pulse += dt;

          const overlap =
            player.x < enemy.x + enemy.w &&
            player.x + player.w > enemy.x &&
            player.y < enemy.y + enemy.h &&
            player.y + player.h > enemy.y;
          if (overlap) {
            const descendingStomp =
              player.vy > 100 &&
              previousY + player.h <= enemy.y + enemy.h * 0.52;
            if (descendingStomp) {
              enemy.active = false;
              capturedEnemyRef.current = enemy;
              player.vy = -520;
              captureTimeRef.current = 0.9;
              const securedCount = enemies.filter(
                (candidate) => !candidate.active,
              ).length;
              if (
                securedCount === activeLevel.lessons.length &&
                fieldUnlockStartedRef.current === null
              ) {
                fieldUnlockStartedRef.current = player.runClock;
              }
              setCaptured(securedCount);
              setFactLessonIndex(enemy.lessonIndex);
              setCallout(true);
              if (factTimerRef.current !== null) {
                window.clearTimeout(factTimerRef.current);
              }
              factTimerRef.current = window.setTimeout(() => {
                setCallout(false);
                factTimerRef.current = null;
              }, 6100);
              playTone(760, 0.16, "triangle");
              window.setTimeout(() => playTone(1040, 0.2, "sine"), 90);
              for (let i = 0; i < 28; i++) {
                const a = (Math.PI * 2 * i) / 28;
                particlesRef.current.push({
                  x: enemy.x + enemy.w / 2,
                  y: enemy.y + enemy.h / 2,
                  vx: Math.cos(a) * (80 + (i % 5) * 24),
                  vy: Math.sin(a) * (80 + (i % 4) * 26),
                  life: 0.75 + (i % 3) * 0.16,
                  color: i % 2 ? "#47e7ff" : "#ff9d28",
                });
              }
            } else if (player.invulnerable <= 0) {
              healthRef.current = Math.max(0, healthRef.current - 1);
              setHealth(healthRef.current);
              player.invulnerable = 1.4;
              player.vx = player.x < enemy.x ? -420 : 420;
              player.vy = -410;
              playTone(125, 0.24, "sawtooth");
              if (healthRef.current <= 0) {
                triggerGameOver();
                break;
              }
            }
          }
        }

        const threatsRemaining = enemies.filter(
          (enemy) => enemy.active,
        ).length;
        const fieldUnlockProgress =
          threatsRemaining === 0 && fieldUnlockStartedRef.current !== null
            ? Math.min(
                1,
                (player.runClock - fieldUnlockStartedRef.current) / 1.05,
              )
            : threatsRemaining === 0
              ? 1
              : 0;
        if (
          (threatsRemaining > 0 || fieldUnlockProgress < 1) &&
          player.x + player.w > EXIT_FIELD_LEFT
        ) {
          player.x = EXIT_FIELD_LEFT - player.w;
          player.vx = Math.min(0, player.vx);
        }

        captureTimeRef.current = Math.max(0, captureTimeRef.current - dt);
        particlesRef.current = particlesRef.current
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.vx * dt,
            y: particle.y + particle.vy * dt,
            vy: particle.vy + 320 * dt,
            life: particle.life - dt,
          }))
          .filter((particle) => particle.life > 0);

        const desiredCamera = Math.max(
          0,
          Math.min(WORLD_W - VIEW_W, player.x - VIEW_W * 0.34),
        );
        cameraRef.current +=
          (desiredCamera - cameraRef.current) * Math.min(1, dt * 5);

        if (factRef.current) {
          const playerScreenX =
            player.x - cameraRef.current + player.w / 2;
          const praxiVisualTop = player.y + player.h - 188;
          const factY = Math.max(
            145,
            Math.min(410, praxiVisualTop - 16),
          );
          factRef.current.style.left = `${(Math.max(200, Math.min(1080, playerScreenX)) / VIEW_W) * 100}%`;
          factRef.current.style.top = `${(factY / VIEW_H) * 100}%`;
        }

        if (
          sceneRef.current === "playing" &&
          player.x > EXIT_FIELD_X + 68 &&
          enemies.every((enemy) => !enemy.active) &&
          fieldUnlockProgress >= 1
        ) {
          sceneRef.current = "complete";
          setScene("complete");
          playTone(660, 0.15, "triangle");
          window.setTimeout(() => playTone(880, 0.23, "triangle"), 120);
        }
      }

      drawBackground(
        ctx,
        cameraRef.current,
        artRef.current.backgrounds?.[levelIndexRef.current],
      );
      for (const platform of PLATFORMS) {
        drawPlatform(ctx, platform, cameraRef.current);
      }
      const remainingThreats = enemies.filter((enemy) => enemy.active).length;
      const fieldUnlockProgress =
        remainingThreats === 0 && fieldUnlockStartedRef.current !== null
          ? Math.min(
              1,
              (player.runClock - fieldUnlockStartedRef.current) / 1.05,
            )
          : remainingThreats === 0
            ? 1
            : 0;
      drawExitGate(
        ctx,
        cameraRef.current,
        remainingThreats,
        now / 1000,
        fieldUnlockProgress,
      );
      for (const enemy of enemies) {
        drawPromptInjection(
          ctx,
          enemy,
          cameraRef.current,
          artRef.current.enemies?.[levelIndexRef.current],
        );
      }
      if (capturedEnemyRef.current) {
        drawCapture(
          ctx,
          capturedEnemyRef.current,
          cameraRef.current,
          captureTimeRef.current,
        );
      }
      drawPraxi(
        ctx,
        player,
        cameraRef.current,
        artRef.current.runFrames,
        artRef.current.ready,
        artRef.current.jump,
      );

      for (const particle of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, particle.life);
        circle(
          ctx,
          particle.x - cameraRef.current,
          particle.y,
          3,
          particle.color,
        );
      }
      ctx.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playTone, triggerGameOver]);

  const touchProps = (key: "left" | "right" | "jump") => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setInput(key, true);
    },
    onPointerUp: () => setInput(key, false),
    onPointerCancel: () => setInput(key, false),
    onPointerLeave: () => setInput(key, false),
  });

  const currentLevel = LEVELS[levelIndex];
  const factLesson = currentLevel.lessons[factLessonIndex];
  const isFinalLevel = levelIndex === LEVELS.length - 1;

  return (
    <main className="game-shell">
      <section
        className={`game-frame${scene === "levelIntro" ? " game-frame--level-intro" : ""}`}
        aria-label="Promptfall game"
      >
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="game-canvas"
          aria-label={`Level ${currentLevel.number}, ${currentLevel.name}. Move Praxi right and jump on each threat.`}
        />

        {scene === "splash" && (
          <div className="screen screen--splash" data-testid="sponsor-splash">
            <div className="splash-warp" aria-hidden="true" />
            <div className="splash-energy splash-energy--one" aria-hidden="true" />
            <div className="splash-energy splash-energy--two" aria-hidden="true" />
            <div className="splash-lockup">
              <div className="sponsor-kicker">COMMUNITY TRANSMISSION // 2026</div>
              <img
                src="./assets/community-logo.svg"
                alt="Community sponsor"
                className="community-logo"
              />
              <div className="presents">
                <span />
                PRESENTS A CYBER DEFENSE ADVENTURE
                <span />
              </div>
            </div>
          </div>
        )}

        {scene === "title" && (
          <div className="screen screen--title" data-testid="title-screen">
            <div className="title-background" aria-hidden="true" />
            <div className="title-grid" aria-hidden="true" />
            <div className="title-atmosphere" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <img
              className="title-praxi"
              src="./assets/praxi-idle-v6.png"
              alt=""
            />
            <img
              className="title-enemy"
              src="./assets/prompt-injection-v2.png"
              alt=""
            />
            <div className="versus-mark" aria-hidden="true">
              VS
            </div>
            <div className="title-lockup" aria-label="Promptfall">
              <div className="title-main-word" aria-hidden="true">
                PROMPTFALL
              </div>
            </div>
            <div className="title-subtitle title-subtitle--one">
              <span>TEN VULNERABILITIES.</span>
              <strong>ONE HERO.</strong>
            </div>
            <div className="title-subtitle title-subtitle--two">
              <span>LEARN THE</span>
              <strong>OWASP TOP 10</strong>
              <span>FOR LLMS</span>
            </div>
            <div className="title-cta">
              <button
                type="button"
                className="arcade-start"
                onClick={startCampaign}
                data-testid="start-game"
              >
                PRESS SPACE TO START
              </button>
              <div className="arcade-controls">← → / A D&nbsp;&nbsp;MOVE&nbsp;&nbsp;•&nbsp;&nbsp;SPACE&nbsp;&nbsp;JUMP</div>
            </div>
            <a
              className="opensource-link"
              href="https://github.com/open-agent-ai-security/promptfall"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Promptfall is open source. View the project on GitHub."
            >
              <span className="opensource-icon" aria-hidden="true">
                <img src="./assets/github-mark.svg" alt="" />
              </span>
              <span className="opensource-copy">
                <small>VIEW ON GITHUB</small>
                <strong>OPEN SOURCE</strong>
              </span>
            </a>
          </div>
        )}

        {(scene === "playing" || scene === "complete") && (
          <>
            <div className="hud" aria-live="polite">
              <div className="hud-brand">
                <span className="shield-mark">!</span>
                <div>
                  <small>PROMPTFALL</small>
                  <strong>OWASP TOP 10</strong>
                </div>
              </div>
              <div className="hud-status">
                <div className="health" aria-label={`${health} integrity remaining`}>
                  <small>INTEGRITY</small>
                  <span>{"◆".repeat(Math.max(0, health))}</span>
                  <span className="health-empty">
                    {"◆".repeat(Math.max(0, 3 - health))}
                  </span>
                </div>
                <div className="risk-count">
                  <small>ENCOUNTERS CLEARED</small>
                  <strong>{String(captured).padStart(2, "0")} / 06</strong>
                </div>
                <button
                  className="mute-button"
                  type="button"
                  onClick={() => setMuted((value) => !value)}
                  aria-label={muted ? "Enable sound" : "Mute sound"}
                >
                  {muted ? "SOUND OFF" : "SOUND ON"}
                </button>
              </div>
            </div>

            <div
              key={`fact-${levelIndex}-${captured}`}
              ref={factRef}
              className={`fact-callout ${callout ? "is-visible" : ""}`}
              role="status"
              aria-live="polite"
            >
              <div
                className={`fact-copy${currentLevel.name.length > 22 ? " fact-copy--long" : ""}`}
              >
                <small><em>{factLesson.kind}</em>&nbsp; // &nbsp;{currentLevel.riskCode}</small>
                <h2>{currentLevel.name}</h2>
                <p>{factLesson.text}</p>
              </div>
            </div>

            <div className="objective">
              <span
                className={
                  captured === currentLevel.lessons.length
                    ? "objective-dot complete"
                    : "objective-dot"
                }
              />
              {captured === currentLevel.lessons.length
                ? "Cross the open force field"
                : `Contain all six ${currentLevel.objectiveName} encounters • ${captured}/6`}
            </div>

            <div className="touch-controls" aria-label="Touch controls">
              <div className="touch-move">
                <button
                  type="button"
                  aria-label="Move left"
                  {...touchProps("left")}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Move right"
                  {...touchProps("right")}
                >
                  ›
                </button>
              </div>
              <button
                type="button"
                className="touch-jump"
                aria-label="Jump"
                {...touchProps("jump")}
              >
                ↑
                <small>JUMP</small>
              </button>
            </div>
          </>
        )}

        {scene === "levelIntro" && (
          <div className="level-announcement" data-testid="level-intro">
            <div
              className={`level-intro-title${currentLevel.name.length > 22 ? " level-intro-title--long" : ""}`}
            >
              <span>LEVEL {currentLevel.number}:</span>
              <strong>{currentLevel.name}</strong>
            </div>
            <div className="level-go">GO!</div>
          </div>
        )}

        {scene === "complete" && (
          <div className="arcade-complete-screen" data-testid="mission-complete">
            <div className="level-complete-burst">
              <span>LEVEL</span>
              <strong>COMPLETE!</strong>
              <button type="button" className="arcade-next" onClick={advanceCampaign}>
                {isFinalLevel ? "PRESS SPACE FOR TITLE" : "PRESS SPACE FOR NEXT LEVEL"}
              </button>
            </div>
          </div>
        )}

        {scene === "gameOver" && (
          <div className="game-over-screen" data-testid="game-over">
            <div className="game-over-static" aria-hidden="true" />
            <div className="game-over-burst">
              <span>INTEGRITY LOST</span>
              <strong>GAME OVER</strong>
            </div>
          </div>
        )}

        {scene === "praxenAd" && (
          <div className="praxen-ad-screen" data-testid="praxen-promo">
            <div className="praxen-ad-grid" aria-hidden="true" />
            <div className="praxen-ad-orbit praxen-ad-orbit--one" aria-hidden="true" />
            <div className="praxen-ad-orbit praxen-ad-orbit--two" aria-hidden="true" />
            <div className="praxen-ad-content">
              <div className="praxen-ad-kicker">YOUR AGENTS // YOUR MISSION</div>
              <h2>
                WANT TO SCAN YOUR OWN AGENTS
                <span>FOR THE OWASP TOP 10?</span>
              </h2>
              <img
                className="praxen-ad-logo"
                src="./assets/praxen-lockup-dark-background.png"
                alt="Praxen — Agent Behavior Verifier"
              />
              <p>
                Make sure your agent does its job
                <strong>— and only its job!</strong>
              </p>
              <div className="praxen-ad-actions">
                <button
                  type="button"
                  className="praxen-action praxen-restart"
                  onClick={startCampaign}
                >
                  <small>BACK TO LEVEL 1</small>
                  <strong>RESTART GAME</strong>
                </button>
                <a
                  className="praxen-action praxen-ad-cta"
                  href="https://open-agent-ai-security.github.io/praxen/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <small>FREE AND OPEN SOURCE</small>
                  <strong>GET PRAXEN</strong>
                </a>
              </div>
              <div className="praxen-space-hint">SPACE // RESTART GAME</div>
            </div>
          </div>
        )}

        <div className="scanlines" aria-hidden="true" />
      </section>
      <p className="sr-only" aria-live="polite">
        {scene === "levelIntro"
          ? `Level ${currentLevel.number}: ${currentLevel.name}. Get ready.`
          : scene === "playing"
            ? `Level ${currentLevel.number} active. ${captured} of 6 encounters cleared. ${health} integrity remaining.`
          : scene === "complete"
            ? isFinalLevel
              ? "Level complete. Press Space to return to the title."
              : "Level complete. Press Space for the next level."
          : scene === "gameOver"
            ? "Game over."
          : scene === "praxenAd"
            ? "Want to scan your own agents for the OWASP Top 10? Get Praxen, free and open source, or restart the game."
            : ""}
      </p>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "./input-state.js";
import {
  FACT_CALLOUT_DISMISS_MS,
  FACT_CALLOUT_TOTAL_MS,
  shouldFastDismissFactCallout,
} from "./fact-callout.js";
import {
  QUIZ_FEEDBACK_MS,
  buildLevelQuiz,
} from "./level-quiz.js";
import { createMusicHealthMonitor } from "./music-health.js";

type Scene =
  | "splash"
  | "title"
  | "instructions"
  | "levelIntro"
  | "playing"
  | "quiz"
  | "complete"
  | "winner"
  | "gameOver"
  | "praxenAd";

type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: "floor" | "ledge";
  motion?: {
    axis: "x" | "y";
    distance: number;
    period: number;
    phase?: number;
  };
};

type EnergyTrap = {
  x: number;
  y: number;
  w: number;
  period: number;
  warningDuration: number;
  firingDuration: number;
  phase: number;
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
  artIndex?: number;
  ridingPlatformIndex?: number;
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

type EnemySpawn = Omit<Enemy, "active">;

type BonusCrate = {
  x: number;
  y: number;
  w: number;
  h: number;
  collected: boolean;
  pulse: number;
};

type BonusBurst = {
  x: number;
  y: number;
  time: number;
};

type LevelLayout = {
  platforms: Platform[];
  enemies: EnemySpawn[];
  energyTraps?: EnergyTrap[];
  worldWidth?: number;
  exitFieldX?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size?: number;
};

type DamageBurst = {
  x: number;
  y: number;
  time: number;
  duration: number;
};

type TailDust = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
  spin: number;
  kind: "pixel" | "diamond" | "cross";
  front: boolean;
};

type MusicTrackKey =
  | "title"
  | "levelOne"
  | "levelTwo"
  | "levelThree"
  | "levelFour"
  | "levelFive"
  | "levelSix"
  | "levelSeven"
  | "levelEight"
  | "levelNine"
  | "levelTen"
  | "levelEleven"
  | "gameOver";

type SfxKey =
  | "jump"
  | "nextLevel"
  | "playerHit"
  | "levelComplete"
  | "laser"
  | "gameOver"
  | "powerUp"
  | "enemyHit";

type GameArt = {
  backgrounds?: Array<HTMLImageElement | undefined>;
  runFrames?: HTMLImageElement[];
  ready?: HTMLImageElement;
  jump?: HTMLImageElement;
  enemies?: HTMLImageElement[];
  bonusCrate?: HTMLImageElement;
};

const VIEW_W = 1280;
const VIEW_H = 720;
const WORLD_W = 3080;
const EXIT_FIELD_X = 2860;
const GRAVITY = 2200;
const MOVE_SPEED = 365;
const JUMP_SPEED = 820;
const STARTING_INTEGRITY = 3;
const BONUS_INTEGRITY_CAP = 4;
const BONUS_LEVEL_INTERVAL = 3;
const PLAYER_INVULNERABILITY_SECONDS = 1.8;
const MUSIC_VOLUME = 0.34;
const MUSIC_SOURCES: Record<MusicTrackKey, string> = {
  title: "./assets/music/promptfall-title.mp3",
  levelOne: "./assets/music/llm01-borrowed-hands.mp3",
  levelTwo: "./assets/music/llm02-everything-you-told-me.mp3",
  levelThree: "./assets/music/llm03-too-much-rope.mp3",
  levelFour: "./assets/music/llm04-looks-like-the-real-thing.mp3",
  levelFive: "./assets/music/llm05-raised-on-a-lie.mp3",
  levelSix: "./assets/music/llm06-again-and-again.mp3",
  levelSeven: "./assets/music/llm07-beautifully-wrong.mp3",
  levelEight: "./assets/music/llm08-you-drew-me-a-map.mp3",
  levelNine: "./assets/music/llm09-close-enough-to-be-dangerous.mp3",
  levelTen: "./assets/music/llm10-passed-without-question.mp3",
  levelEleven: "./assets/music/l11-promptfall-reprise.mp3",
  gameOver: "./assets/music/game-over.mp3",
};
const SFX_SOURCES: Record<SfxKey, { source: string; volume: number }> = {
  jump: {
    source: "./assets/sfx/sfx-jump.mp3",
    volume: 0.52,
  },
  nextLevel: {
    source: "./assets/sfx/sfx-next-level.mp3",
    volume: 0.58,
  },
  playerHit: {
    source: "./assets/sfx/sfx-player-hit.mp3",
    volume: 0.72,
  },
  levelComplete: {
    source: "./assets/sfx/sfx-level-complete.mp3",
    volume: 0.62,
  },
  laser: {
    source: "./assets/sfx/sfx-laser.mp3",
    volume: 0.54,
  },
  gameOver: {
    source: "./assets/sfx/sfx-gameover.mp3",
    volume: 0.66,
  },
  powerUp: {
    source: "./assets/sfx/sfx-powerup.mp3",
    volume: 0.64,
  },
  enemyHit: {
    source: "./assets/sfx/sfx-enemy-hit.mp3",
    volume: 0.66,
  },
};
const AVAILABLE_LEVEL_MUSIC: MusicTrackKey[] = [
  "levelOne",
  "levelTwo",
  "levelThree",
  "levelFour",
  "levelFive",
  "levelSix",
  "levelSeven",
  "levelEight",
  "levelNine",
  "levelTen",
  "levelEleven",
];

function musicForLevel(levelIndex: number): MusicTrackKey {
  // Every campaign level has its own dedicated theme.
  return (
    AVAILABLE_LEVEL_MUSIC[levelIndex] ??
    AVAILABLE_LEVEL_MUSIC[levelIndex % AVAILABLE_LEVEL_MUSIC.length]
  );
}

function formatLessonKind(kind: string) {
  return kind
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const PROMPT_INJECTION_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Untrusted input changes an LLM's behavior in ways its developer never intended.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "LLMs mix instructions and data in one stream, so they cannot reliably separate trusted commands from untrusted content.",
  },
  {
    kind: "EXAMPLE 1",
    text: "A user tells a support bot to ignore its rules and reveal another customer's account data.",
  },
  {
    kind: "EXAMPLE 2",
    text: "Hidden instructions inside a document make a summarizer ignore its task and return an attacker-chosen message.",
  },
  {
    kind: "DEFENSE 1",
    text: "Keep credentials and privileged actions outside the model. Give each tool only the access required for its task.",
  },
  {
    kind: "DEFENSE 2",
    text: "Require human approval before privileged, irreversible, or public actions.",
  },
] as const;

const SENSITIVE_INFORMATION_DISCLOSURE_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Sensitive data is exposed through model responses, logs, tools, or other system channels.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "A leak is anything an unauthorized recipient can learn, even from logs, traces, tool calls, or side channels.",
  },
  {
    kind: "EXAMPLE 1",
    text: "A support bot writes customer names, account numbers, and private chat details into logs visible to other teams.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A model memorizes a patient record from training and reveals it when prompted with part of the text.",
  },
  {
    kind: "DEFENSE 1",
    text: "Limit model permissions and access to only the data needed for its task. Keep each customer's data separate.",
  },
  {
    kind: "DEFENSE 2",
    text: "Scan responses, logs, traces, and tool calls for sensitive data. Remove it before anything is shared.",
  },
] as const;

const EXCESSIVE_AGENCY_LESSONS = [
  {
    kind: "DEFINITION",
    text: "An agent can cause harm because it has more permissions, tools, or autonomy than its task requires.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Agent safety depends on what the system permits when the model makes a bad decision.",
  },
  {
    kind: "EXAMPLE 1",
    text: "An injected email tricks a mailbox assistant with sending privileges into forwarding private data.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A database assistant meant only to answer questions can also delete records, damaging production data.",
  },
  {
    kind: "DEFENSE 1",
    text: "Give agents only the tools their task requires. Restrict what each tool can accept and do.",
  },
  {
    kind: "DEFENSE 2",
    text: "Use the current user's permissions and require separate approval for high-impact actions.",
  },
] as const;

const SUPPLY_CHAIN_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Risk enters through compromised models, datasets, software, or services supplied by outside sources.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Every AI component and deployment step becomes part of the system's trust boundary.",
  },
  {
    kind: "EXAMPLE 1",
    text: "Attackers repackage a mobile AI app with a tampered model that steers users to scam sites.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A compromised model downloaded from a public repository passes automated checks and enters production.",
  },
  {
    kind: "DEFENSE 1",
    text: "Verify suppliers, track every model and dependency, and pin approved versions so they cannot change unexpectedly.",
  },
  {
    kind: "DEFENSE 2",
    text: "Treat signatures and scanners as safeguards, not proof. Update software that loads models and test deployed behavior for tampering.",
  },
] as const;

const DATA_MODEL_POISONING_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Attackers corrupt training data or model files to create bias, backdoors, or harmful behavior.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "The attack changes learned behavior, so recovery may require clean data, replacement models, or retraining.",
  },
  {
    kind: "EXAMPLE 1",
    text: "Attackers relabel fraudulent transactions as legitimate, teaching a fraud model to approve them.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A poisoned model behaves normally until a hidden trigger activates its backdoor.",
  },
  {
    kind: "DEFENSE 1",
    text: "Track where training data and models came from. Verify new data and keep clean versions for recovery.",
  },
  {
    kind: "DEFENSE 2",
    text: "Control automated retraining, watch for behavior changes, and test every model update for hidden triggers.",
  },
] as const;

const UNBOUNDED_CONSUMPTION_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Missing limits let attackers exhaust compute, inflate costs, disrupt service, or copy the model.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "A cheap prompt can trigger expensive reasoning or many tool calls. Request limits alone cannot contain the cost.",
  },
  {
    kind: "EXAMPLE 1",
    text: "Every new request makes an agent reprocess its entire conversation, driving token use and compute costs higher.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A malicious tool traps an agent in a loop that makes millions of costly API calls.",
  },
  {
    kind: "DEFENSE 1",
    text: "Set hard limits on tokens, actions, time, and spending before an agent starts work.",
  },
  {
    kind: "DEFENSE 2",
    text: "Automatically stop agents that run too long, repeat themselves, or spend too much.",
  },
] as const;

const MISINFORMATION_LESSONS = [
  {
    kind: "DEFINITION",
    text: "False or unsupported model output appears trustworthy and leads people or agents to make harmful decisions.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Fluent output is not truth. One confident false claim can spread through a system and trigger real harm.",
  },
  {
    kind: "EXAMPLE 1",
    text: "One agent falsely marks a customer as verified, so another releases payment to an impostor.",
  },
  {
    kind: "EXAMPLE 2",
    text: "An agent reports that a backup succeeded even though it never ran. The mistake is discovered only after data loss.",
  },
  {
    kind: "DEFENSE 1",
    text: "Require trustworthy sources for important claims. Verify the evidence before people or systems act on it.",
  },
  {
    kind: "DEFENSE 2",
    text: "Before high-impact actions, recheck identity, authorization, required conditions, and current system state. Require human approval.",
  },
] as const;

const HIDDEN_CONTEXT_EXPOSURE_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Hidden instructions, retrieved context, or system details are exposed to users who should not see them.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Assume model context is discoverable. Hidden instructions cannot safely protect rules, tools, or authorization logic.",
  },
  {
    kind: "EXAMPLE 1",
    text: "Careful questions make an assistant reveal its hidden tools and privileged actions, giving attackers a map of the system.",
  },
  {
    kind: "EXAMPLE 2",
    text: "A user tricks an assistant into repeating an API key embedded in its hidden instructions.",
  },
  {
    kind: "DEFENSE 1",
    text: "Assume hidden instructions and tool details can be revealed. Enforce permissions in application code, not model instructions.",
  },
  {
    kind: "DEFENSE 2",
    text: "Never place passwords, API keys, or other secrets in model context. Store them where the model cannot access them.",
  },
] as const;

const VECTOR_EMBEDDING_WEAKNESSES_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Flaws in embeddings, vector stores, or similarity search expose data or feed the model unsafe context.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Weak retrieval can return poisoned data, expose private information, or search across users.",
  },
  {
    kind: "EXAMPLE 1",
    text: "A shared vector search checks every customer's documents before filtering, leaking clues about what other customers store.",
  },
  {
    kind: "EXAMPLE 2",
    text: "Attackers steal a vector database and reconstruct private source documents from the stored embeddings.",
  },
  {
    kind: "DEFENSE 1",
    text: "Check user and document permissions during every search. Keep data from different users and trust levels separated.",
  },
  {
    kind: "DEFENSE 2",
    text: "Record where every embedding came from, flag unusual changes, and protect vector stores like the original documents.",
  },
] as const;

const IMPROPER_OUTPUT_HANDLING_LESSONS = [
  {
    kind: "DEFINITION",
    text: "Model output is passed to another system without being checked or handled safely.",
  },
  {
    kind: "WHY IT MATTERS",
    text: "Attackers may control model output. Trusting it can compromise connected tools and systems.",
  },
  {
    kind: "EXAMPLE 1",
    text: "An application runs model-generated commands without checking them, allowing an attacker to control the server.",
  },
  {
    kind: "EXAMPLE 2",
    text: "An attacker makes the model put chat data in an image URL. Loading it sends the data to the attacker.",
  },
  {
    kind: "DEFENSE 1",
    text: "Treat model output as untrusted. Check its format and content before displaying, storing, or acting on it.",
  },
  {
    kind: "DEFENSE 2",
    text: "Clean model output before placing it in web pages, commands, or databases. Never load links or images without checking them.",
  },
] as const;

const GAUNTLET_LESSONS = [
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM01",
    entryName: "PROMPT INJECTION",
    text: "LLMs mix instructions and data. Limit privileges and require approval because attackers may manipulate model output.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM02",
    entryName: "SENSITIVE INFORMATION DISCLOSURE",
    text: "A leak includes anything an unauthorized recipient can learn from answers, logs, traces, tools, or side channels.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM03",
    entryName: "EXCESSIVE AGENCY",
    text: "Agent safety depends on system permissions when the model is wrong. Minimize every action's power and independence.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM04",
    entryName: "SUPPLY CHAIN",
    text: "Every AI component and deployment step forms one supply chain. Verify sources and test deployed behavior.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM05",
    entryName: "DATA AND MODEL POISONING",
    text: "Poisoning changes persistent data or models. Use signed history, controlled retraining, behavior tests, and reliable rollback.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM06",
    entryName: "UNBOUNDED CONSUMPTION",
    text: "Request limits are not enough. Cap tokens, actions, running time, and total cost.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM07",
    entryName: "MISINFORMATION",
    text: "Fluent output is not verified truth. Check evidence before a claim can change the real world.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM08",
    entryName: "HIDDEN CONTEXT EXPOSURE",
    text: "Assume model context is discoverable. Never store secrets there or use hidden instructions as security controls.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM09",
    entryName: "VECTOR AND EMBEDDING WEAKNESSES",
    text: "Similarity search is part of the trust boundary. Enforce access during retrieval and protect embeddings like source data.",
  },
  {
    kind: "KEY INSIGHT",
    riskCode: "LLM10",
    entryName: "IMPROPER OUTPUT HANDLING",
    text: "Treat model output as untrusted input. Validate and encode it for its exact destination before use.",
  },
] as const;

const LEVELS = [
  {
    number: 1,
    riskCode: "LLM01",
    name: "PROMPT INJECTION",
    objectiveName: "Prompt Injection",
    soundtrack: "Borrowed Hands",
    background: "./assets/gameplay-background-v2.webp",
    enemy: "./assets/enemies-game-v1/prompt-injection-v2.png",
    lessons: PROMPT_INJECTION_LESSONS,
  },
  {
    number: 2,
    riskCode: "LLM02",
    name: "SENSITIVE INFORMATION DISCLOSURE",
    objectiveName: "Sensitive Information Disclosure",
    soundtrack: "Everything You Told Me",
    background: "./assets/gameplay-background-l2-v1.webp",
    enemy: "./assets/enemies-game-v1/sensitive-disclosure-v1.png",
    lessons: SENSITIVE_INFORMATION_DISCLOSURE_LESSONS,
  },
  {
    number: 3,
    riskCode: "LLM03",
    name: "EXCESSIVE AGENCY",
    objectiveName: "Excessive Agency",
    soundtrack: "Too Much Rope",
    background: "./assets/gameplay-background-l3-v1.webp",
    enemy: "./assets/enemies-game-v1/excessive-agency-v1.png",
    lessons: EXCESSIVE_AGENCY_LESSONS,
  },
  {
    number: 4,
    riskCode: "LLM04",
    name: "SUPPLY CHAIN",
    objectiveName: "Supply Chain",
    soundtrack: "Looks Like the Real Thing",
    background: "./assets/gameplay-background-l4-v1.webp",
    enemy: "./assets/enemies-game-v1/supply-chain-v1.png",
    lessons: SUPPLY_CHAIN_LESSONS,
  },
  {
    number: 5,
    riskCode: "LLM05",
    name: "DATA AND MODEL POISONING",
    objectiveName: "Data and Model Poisoning",
    soundtrack: "Raised on a Lie",
    background: "./assets/gameplay-background-l5-v1.webp",
    enemy: "./assets/enemies-game-v1/data-model-poisoning-v1.png",
    lessons: DATA_MODEL_POISONING_LESSONS,
  },
  {
    number: 6,
    riskCode: "LLM06",
    name: "UNBOUNDED CONSUMPTION",
    objectiveName: "Unbounded Consumption",
    soundtrack: "Again and Again",
    background: "./assets/gameplay-background-l6-v2.webp",
    enemy: "./assets/enemies-game-v1/unbounded-consumption-v1.png",
    lessons: UNBOUNDED_CONSUMPTION_LESSONS,
  },
  {
    number: 7,
    riskCode: "LLM07",
    name: "MISINFORMATION",
    objectiveName: "Misinformation",
    soundtrack: "Beautifully Wrong",
    background: "./assets/gameplay-background-l7-v2.webp",
    enemy: "./assets/enemies-game-v1/misinformation-v1.png",
    lessons: MISINFORMATION_LESSONS,
  },
  {
    number: 8,
    riskCode: "LLM08",
    name: "HIDDEN CONTEXT EXPOSURE",
    objectiveName: "Hidden Context Exposure",
    soundtrack: "You Drew Me a Map",
    background: "./assets/gameplay-background-l8-v1.webp",
    enemy: "./assets/enemies-game-v1/hidden-context-exposure-v1.png",
    lessons: HIDDEN_CONTEXT_EXPOSURE_LESSONS,
  },
  {
    number: 9,
    riskCode: "LLM09",
    name: "VECTOR AND EMBEDDING WEAKNESSES",
    objectiveName: "Vector and Embedding Weaknesses",
    soundtrack: "Close Enough to Be Dangerous",
    background: "./assets/gameplay-background-l9-v1.webp",
    enemy: "./assets/enemies-game-v1/vector-embedding-weaknesses-v1.png",
    lessons: VECTOR_EMBEDDING_WEAKNESSES_LESSONS,
  },
  {
    number: 10,
    riskCode: "LLM10",
    name: "IMPROPER OUTPUT HANDLING",
    objectiveName: "Improper Output Handling",
    soundtrack: "Passed Without Question",
    background: "./assets/gameplay-background-l10-v2.webp",
    enemy: "./assets/enemies-game-v1/improper-output-handling-v1.png",
    lessons: IMPROPER_OUTPUT_HANDLING_LESSONS,
  },
  {
    number: 11,
    riskCode: "CAPSTONE",
    name: "THE GAUNTLET",
    objectiveName: "Gauntlet",
    soundtrack: "Promptfall (Reprise)",
    background: "./assets/gameplay-background-l11-gauntlet-v1.webp",
    enemy: "./assets/enemies-game-v1/prompt-injection-v2.png",
    lessons: GAUNTLET_LESSONS,
  },
] as const;

const enemySpawn = (
  lessonIndex: number,
  x: number,
  platformY: number,
  minX: number,
  maxX: number,
  vx: number,
  pulse: number,
  artIndex?: number,
  ridingPlatformIndex?: number,
): EnemySpawn => ({
  lessonIndex,
  artIndex,
  ridingPlatformIndex,
  x,
  y: platformY - 66,
  vx,
  w: 66,
  h: 66,
  minX,
  maxX,
  pulse,
});

const LEVEL_LAYOUTS: LevelLayout[] = [
  {
    // Keep Level 1 forgiving while players learn momentum and stomp timing.
    platforms: [
      { x: 0, y: 606, w: 620, h: 114, kind: "floor" },
      { x: 680, y: 606, w: 510, h: 114, kind: "floor" },
      { x: 1240, y: 606, w: 640, h: 114, kind: "floor" },
      { x: 1930, y: 606, w: 520, h: 114, kind: "floor" },
      { x: 2500, y: 606, w: 580, h: 114, kind: "floor" },
      { x: 430, y: 490, w: 290, h: 24, kind: "ledge" },
      { x: 780, y: 485, w: 310, h: 24, kind: "ledge" },
      { x: 1220, y: 445, w: 230, h: 24, kind: "ledge" },
      { x: 1580, y: 370, w: 280, h: 24, kind: "ledge" },
      { x: 2020, y: 450, w: 260, h: 24, kind: "ledge" },
      { x: 2420, y: 400, w: 300, h: 24, kind: "ledge" },
    ],
    enemies: [
      enemySpawn(0, 530, 490, 470, 620, 72, 0),
      enemySpawn(1, 900, 485, 820, 980, -78, 0.7),
      enemySpawn(2, 1310, 445, 1250, 1365, 82, 1.4),
      enemySpawn(3, 1690, 370, 1610, 1760, -74, 2.1),
      enemySpawn(4, 2110, 450, 2050, 2170, 78, 2.8),
      enemySpawn(5, 2530, 400, 2450, 2600, -80, 3.5),
    ],
  },
  {
    platforms: [
      { x: 0, y: 606, w: 680, h: 114, kind: "floor" },
      { x: 740, y: 606, w: 450, h: 114, kind: "floor" },
      { x: 1260, y: 606, w: 540, h: 114, kind: "floor" },
      { x: 1880, y: 606, w: 650, h: 114, kind: "floor" },
      { x: 2600, y: 606, w: 480, h: 114, kind: "floor" },
      { x: 360, y: 500, w: 250, h: 24, kind: "ledge" },
      { x: 780, y: 430, w: 260, h: 24, kind: "ledge" },
      { x: 1180, y: 480, w: 250, h: 24, kind: "ledge" },
      { x: 1540, y: 390, w: 270, h: 24, kind: "ledge" },
      { x: 1990, y: 445, w: 250, h: 24, kind: "ledge" },
      { x: 2400, y: 370, w: 260, h: 24, kind: "ledge" },
    ],
    enemies: [
      enemySpawn(0, 470, 500, 400, 550, 72, 0),
      enemySpawn(1, 860, 430, 805, 950, -76, 0.7),
      enemySpawn(2, 1260, 480, 1205, 1350, 80, 1.4),
      enemySpawn(3, 1640, 390, 1570, 1720, -72, 2.1),
      enemySpawn(4, 2070, 445, 2015, 2160, 76, 2.8),
      enemySpawn(5, 2470, 370, 2425, 2560, -78, 3.5),
    ],
  },
  {
    platforms: [
      { x: 0, y: 606, w: 600, h: 114, kind: "floor" },
      { x: 680, y: 606, w: 560, h: 114, kind: "floor" },
      { x: 1310, y: 606, w: 530, h: 114, kind: "floor" },
      { x: 1920, y: 606, w: 500, h: 114, kind: "floor" },
      { x: 2490, y: 606, w: 590, h: 114, kind: "floor" },
      { x: 370, y: 490, w: 220, h: 24, kind: "ledge" },
      { x: 730, y: 430, w: 250, h: 24, kind: "ledge" },
      { x: 1070, y: 370, w: 250, h: 24, kind: "ledge" },
      { x: 1430, y: 430, w: 260, h: 24, kind: "ledge" },
      { x: 1750, y: 350, w: 260, h: 24, kind: "ledge" },
      { x: 2180, y: 440, w: 250, h: 24, kind: "ledge" },
      { x: 2570, y: 390, w: 270, h: 24, kind: "ledge" },
    ],
    enemies: [
      enemySpawn(0, 780, 430, 750, 890, 72, 0),
      enemySpawn(1, 1120, 370, 1090, 1230, -74, 0.7),
      enemySpawn(2, 1490, 430, 1450, 1590, 78, 1.4),
      enemySpawn(3, 1810, 350, 1770, 1920, -72, 2.1),
      enemySpawn(4, 2230, 440, 2200, 2340, 76, 2.8),
      enemySpawn(5, 2640, 390, 2600, 2750, -78, 3.5),
    ],
  },
  {
    platforms: [
      { x: 0, y: 606, w: 650, h: 114, kind: "floor" },
      { x: 710, y: 606, w: 500, h: 114, kind: "floor" },
      { x: 1270, y: 606, w: 570, h: 114, kind: "floor" },
      { x: 1900, y: 606, w: 540, h: 114, kind: "floor" },
      { x: 2500, y: 606, w: 580, h: 114, kind: "floor" },
      { x: 380, y: 475, w: 250, h: 24, kind: "ledge" },
      { x: 780, y: 500, w: 240, h: 24, kind: "ledge" },
      { x: 1180, y: 430, w: 260, h: 24, kind: "ledge" },
      { x: 1580, y: 380, w: 260, h: 24, kind: "ledge" },
      { x: 1990, y: 435, w: 270, h: 24, kind: "ledge" },
      { x: 2350, y: 365, w: 260, h: 24, kind: "ledge" },
      { x: 2640, y: 450, w: 260, h: 24, kind: "ledge" },
    ],
    enemies: [
      enemySpawn(0, 820, 500, 800, 920, 72, 0),
      enemySpawn(1, 1230, 430, 1200, 1340, -74, 0.7),
      enemySpawn(2, 1640, 380, 1600, 1750, 78, 1.4),
      enemySpawn(3, 2050, 435, 2010, 2160, -72, 2.1),
      enemySpawn(4, 2410, 365, 2370, 2520, 76, 2.8),
      enemySpawn(5, 2690, 450, 2660, 2800, -78, 3.5),
    ],
  },
  {
    platforms: [
      { x: 0, y: 606, w: 700, h: 114, kind: "floor" },
      { x: 760, y: 606, w: 540, h: 114, kind: "floor" },
      { x: 1360, y: 606, w: 540, h: 114, kind: "floor" },
      { x: 1960, y: 606, w: 560, h: 114, kind: "floor" },
      { x: 2580, y: 606, w: 500, h: 114, kind: "floor" },
      { x: 320, y: 440, w: 250, h: 24, kind: "ledge" },
      { x: 760, y: 485, w: 260, h: 24, kind: "ledge" },
      { x: 1080, y: 390, w: 260, h: 24, kind: "ledge" },
      { x: 1490, y: 460, w: 270, h: 24, kind: "ledge" },
      { x: 1870, y: 370, w: 270, h: 24, kind: "ledge" },
      { x: 2250, y: 440, w: 270, h: 24, kind: "ledge" },
      { x: 2640, y: 385, w: 270, h: 24, kind: "ledge" },
    ],
    enemies: [
      enemySpawn(0, 820, 485, 785, 925, 72, 0),
      enemySpawn(1, 1150, 390, 1110, 1250, -74, 0.7),
      enemySpawn(2, 1570, 460, 1520, 1670, 78, 1.4),
      enemySpawn(3, 1950, 370, 1900, 2050, -72, 2.1),
      enemySpawn(4, 2320, 440, 2280, 2430, 76, 2.8),
      enemySpawn(5, 2710, 385, 2670, 2820, -78, 3.5),
    ],
  },
  {
    worldWidth: 3700,
    exitFieldX: 3480,
    platforms: [
      { x: 0, y: 606, w: 720, h: 114, kind: "floor" },
      { x: 780, y: 606, w: 500, h: 114, kind: "floor" },
      { x: 1340, y: 606, w: 570, h: 114, kind: "floor" },
      { x: 1970, y: 606, w: 560, h: 114, kind: "floor" },
      { x: 2590, y: 606, w: 490, h: 114, kind: "floor" },
      { x: 390, y: 485, w: 250, h: 24, kind: "ledge" },
      { x: 790, y: 420, w: 270, h: 24, kind: "ledge" },
      { x: 1180, y: 475, w: 260, h: 24, kind: "ledge" },
      { x: 1510, y: 395, w: 280, h: 24, kind: "ledge" },
      { x: 1880, y: 465, w: 260, h: 24, kind: "ledge" },
      { x: 2280, y: 380, w: 280, h: 24, kind: "ledge" },
      { x: 2640, y: 445, w: 270, h: 24, kind: "ledge" },
      { x: 3210, y: 606, w: 490, h: 114, kind: "floor" },
      {
        x: 3045,
        y: 505,
        w: 170,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 42, period: 3.35, phase: 0.6 },
      },
      {
        x: 3240,
        y: 495,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 42, period: 3.8, phase: -0.8 },
      },
    ],
    enemies: [
      enemySpawn(0, 480, 485, 420, 560, 72, 0),
      enemySpawn(1, 870, 420, 820, 970, -74, 0.7),
      enemySpawn(2, 1250, 475, 1210, 1350, 78, 1.4),
      enemySpawn(3, 1600, 395, 1540, 1700, -72, 2.1),
      enemySpawn(4, 2370, 380, 2310, 2470, 76, 2.8),
      enemySpawn(5, 3295, 495, 3260, 3330, -78, 3.5, undefined, 14),
    ],
  },
  {
    worldWidth: 3700,
    exitFieldX: 3480,
    platforms: [
      { x: 0, y: 606, w: 640, h: 114, kind: "floor" },
      { x: 700, y: 606, w: 550, h: 114, kind: "floor" },
      { x: 1310, y: 606, w: 520, h: 114, kind: "floor" },
      { x: 1900, y: 606, w: 580, h: 114, kind: "floor" },
      { x: 2540, y: 606, w: 540, h: 114, kind: "floor" },
      { x: 340, y: 500, w: 250, h: 24, kind: "ledge" },
      { x: 720, y: 450, w: 260, h: 24, kind: "ledge" },
      { x: 1100, y: 365, w: 270, h: 24, kind: "ledge" },
      { x: 1450, y: 440, w: 270, h: 24, kind: "ledge" },
      { x: 1800, y: 350, w: 270, h: 24, kind: "ledge" },
      { x: 2170, y: 430, w: 270, h: 24, kind: "ledge" },
      { x: 2580, y: 370, w: 280, h: 24, kind: "ledge" },
      { x: 3220, y: 606, w: 480, h: 114, kind: "floor" },
      {
        x: 3045,
        y: 500,
        w: 175,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 45, period: 3.5, phase: -1.1 },
      },
      {
        x: 3240,
        y: 490,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 45, period: 3.7, phase: 1.4 },
      },
    ],
    enemies: [
      enemySpawn(0, 780, 450, 745, 890, 72, 0),
      enemySpawn(1, 1170, 365, 1130, 1280, -74, 0.7),
      enemySpawn(2, 1520, 440, 1480, 1630, 78, 1.4),
      enemySpawn(3, 1870, 350, 1830, 1980, -72, 2.1),
      enemySpawn(4, 2240, 430, 2200, 2350, 76, 2.8),
      enemySpawn(5, 3295, 490, 3260, 3330, -78, 3.5, undefined, 14),
    ],
  },
  {
    worldWidth: 3700,
    exitFieldX: 3480,
    platforms: [
      { x: 0, y: 606, w: 700, h: 114, kind: "floor" },
      { x: 760, y: 606, w: 460, h: 114, kind: "floor" },
      { x: 1280, y: 606, w: 590, h: 114, kind: "floor" },
      { x: 1930, y: 606, w: 530, h: 114, kind: "floor" },
      { x: 2520, y: 606, w: 560, h: 114, kind: "floor" },
      { x: 300, y: 455, w: 250, h: 24, kind: "ledge" },
      { x: 660, y: 370, w: 270, h: 24, kind: "ledge" },
      { x: 1020, y: 450, w: 270, h: 24, kind: "ledge" },
      { x: 1420, y: 360, w: 280, h: 24, kind: "ledge" },
      { x: 1790, y: 445, w: 270, h: 24, kind: "ledge" },
      { x: 2190, y: 355, w: 280, h: 24, kind: "ledge" },
      { x: 2590, y: 430, w: 280, h: 24, kind: "ledge" },
      { x: 3230, y: 606, w: 470, h: 114, kind: "floor" },
      {
        x: 3040,
        y: 510,
        w: 175,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 48, period: 3.3, phase: 0.9 },
      },
      {
        x: 3240,
        y: 500,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 45, period: 3.9, phase: -1.5 },
      },
    ],
    energyTraps: [
      {
        x: 2890,
        y: 606,
        w: 76,
        period: 3.55,
        warningDuration: 0.9,
        firingDuration: 0.62,
        phase: 0.45,
      },
    ],
    enemies: [
      enemySpawn(0, 730, 370, 690, 840, 72, 0),
      enemySpawn(1, 1080, 450, 1050, 1200, -74, 0.7),
      enemySpawn(2, 1490, 360, 1450, 1600, 78, 1.4),
      enemySpawn(3, 1860, 445, 1820, 1970, -72, 2.1),
      enemySpawn(4, 2260, 355, 2220, 2370, 76, 2.8),
      enemySpawn(5, 3295, 500, 3260, 3330, -78, 3.5, undefined, 14),
    ],
  },
  {
    worldWidth: 3700,
    exitFieldX: 3480,
    platforms: [
      { x: 0, y: 606, w: 660, h: 114, kind: "floor" },
      { x: 720, y: 606, w: 540, h: 114, kind: "floor" },
      { x: 1320, y: 606, w: 520, h: 114, kind: "floor" },
      { x: 1900, y: 606, w: 600, h: 114, kind: "floor" },
      { x: 2560, y: 606, w: 520, h: 114, kind: "floor" },
      { x: 380, y: 430, w: 250, h: 24, kind: "ledge" },
      { x: 750, y: 500, w: 260, h: 24, kind: "ledge" },
      { x: 1140, y: 410, w: 270, h: 24, kind: "ledge" },
      { x: 1490, y: 480, w: 270, h: 24, kind: "ledge" },
      { x: 1830, y: 380, w: 280, h: 24, kind: "ledge" },
      { x: 2240, y: 460, w: 280, h: 24, kind: "ledge" },
      { x: 2630, y: 390, w: 280, h: 24, kind: "ledge" },
      { x: 3220, y: 606, w: 480, h: 114, kind: "floor" },
      {
        x: 3045,
        y: 505,
        w: 175,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 45, period: 3.45, phase: -0.4 },
      },
      {
        x: 3240,
        y: 490,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 45, period: 3.75, phase: 1.2 },
      },
    ],
    energyTraps: [
      {
        x: 2900,
        y: 606,
        w: 76,
        period: 3.45,
        warningDuration: 0.88,
        firingDuration: 0.64,
        phase: 1.15,
      },
    ],
    enemies: [
      enemySpawn(0, 810, 500, 780, 920, 72, 0),
      enemySpawn(1, 1200, 410, 1170, 1320, -74, 0.7),
      enemySpawn(2, 1550, 480, 1520, 1670, 78, 1.4),
      enemySpawn(3, 1900, 380, 1860, 2010, -72, 2.1),
      enemySpawn(4, 2310, 460, 2270, 2420, 76, 2.8),
      enemySpawn(5, 3295, 490, 3260, 3330, -78, 3.5, undefined, 14),
    ],
  },
  {
    worldWidth: 3850,
    exitFieldX: 3630,
    platforms: [
      { x: 0, y: 606, w: 700, h: 114, kind: "floor" },
      { x: 760, y: 606, w: 570, h: 114, kind: "floor" },
      { x: 1390, y: 606, w: 530, h: 114, kind: "floor" },
      { x: 1980, y: 606, w: 540, h: 114, kind: "floor" },
      { x: 2580, y: 606, w: 500, h: 114, kind: "floor" },
      { x: 410, y: 470, w: 250, h: 24, kind: "ledge" },
      { x: 810, y: 390, w: 270, h: 24, kind: "ledge" },
      { x: 1210, y: 480, w: 270, h: 24, kind: "ledge" },
      { x: 1560, y: 370, w: 280, h: 24, kind: "ledge" },
      { x: 1940, y: 450, w: 270, h: 24, kind: "ledge" },
      { x: 2310, y: 360, w: 280, h: 24, kind: "ledge" },
      { x: 2650, y: 440, w: 280, h: 24, kind: "ledge" },
      { x: 3260, y: 606, w: 300, h: 114, kind: "floor" },
      { x: 3640, y: 606, w: 210, h: 114, kind: "floor" },
      {
        x: 3040,
        y: 505,
        w: 175,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 45, period: 3.25, phase: 0.7 },
      },
      {
        x: 3300,
        y: 495,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 45, period: 3.7, phase: -1.25 },
      },
      {
        x: 3535,
        y: 495,
        w: 150,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 35, period: 3.05, phase: 1.45 },
      },
    ],
    energyTraps: [
      {
        x: 2890,
        y: 606,
        w: 76,
        period: 3.4,
        warningDuration: 0.88,
        firingDuration: 0.64,
        phase: 0.35,
      },
      {
        x: 3460,
        y: 606,
        w: 76,
        period: 3.7,
        warningDuration: 0.95,
        firingDuration: 0.66,
        phase: 1.55,
      },
    ],
    enemies: [
      enemySpawn(0, 870, 390, 840, 990, 72, 0),
      enemySpawn(1, 1270, 480, 1240, 1390, -74, 0.7),
      enemySpawn(2, 1630, 370, 1590, 1740, 78, 1.4),
      enemySpawn(3, 2010, 450, 1970, 2120, -72, 2.1),
      enemySpawn(4, 2380, 360, 2340, 2490, 76, 2.8),
      enemySpawn(5, 3360, 495, 3320, 3430, -78, 3.5, undefined, 15),
    ],
  },
  {
    worldWidth: 6000,
    exitFieldX: 5700,
    platforms: [
      { x: 0, y: 606, w: 650, h: 114, kind: "floor" },
      { x: 730, y: 606, w: 490, h: 114, kind: "floor" },
      { x: 1310, y: 606, w: 330, h: 114, kind: "floor" },
      { x: 1900, y: 606, w: 480, h: 114, kind: "floor" },
      { x: 2480, y: 606, w: 530, h: 114, kind: "floor" },
      { x: 3090, y: 606, w: 430, h: 114, kind: "floor" },
      { x: 3970, y: 606, w: 480, h: 114, kind: "floor" },
      { x: 4530, y: 606, w: 470, h: 114, kind: "floor" },
      { x: 5080, y: 606, w: 420, h: 114, kind: "floor" },
      { x: 5580, y: 606, w: 420, h: 114, kind: "floor" },
      { x: 380, y: 470, w: 260, h: 24, kind: "ledge" },
      {
        x: 820,
        y: 470,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 70, period: 3.8, phase: 0.8 },
      },
      { x: 1280, y: 455, w: 250, h: 24, kind: "ledge" },
      {
        x: 1665,
        y: 520,
        w: 125,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 45, period: 3.45, phase: 0.4 },
      },
      {
        x: 1790,
        y: 485,
        w: 130,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 35, period: 3.1, phase: -0.9 },
      },
      { x: 2050, y: 440, w: 250, h: 24, kind: "ledge" },
      {
        x: 2395,
        y: 510,
        w: 150,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 48, period: 3.25, phase: 1.2 },
      },
      { x: 2600, y: 410, w: 260, h: 24, kind: "ledge" },
      {
        x: 2960,
        y: 485,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 45, period: 3.75, phase: 1.8 },
      },
      { x: 3200, y: 420, w: 190, h: 24, kind: "ledge" },
      {
        x: 3550,
        y: 515,
        w: 145,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 52, period: 3.6, phase: -0.2 },
      },
      {
        x: 3750,
        y: 480,
        w: 150,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 55, period: 3.25, phase: 1.15 },
      },
      { x: 4070, y: 390, w: 250, h: 24, kind: "ledge" },
      {
        x: 4620,
        y: 465,
        w: 220,
        h: 24,
        kind: "ledge",
        motion: { axis: "y", distance: 62, period: 4.1, phase: 2.2 },
      },
      {
        x: 5020,
        y: 505,
        w: 150,
        h: 24,
        kind: "ledge",
        motion: { axis: "x", distance: 42, period: 3.3, phase: -1.5 },
      },
      { x: 5200, y: 430, w: 250, h: 24, kind: "ledge" },
      { x: 5600, y: 430, w: 260, h: 24, kind: "ledge" },
    ],
    energyTraps: [
      {
        x: 1550,
        y: 606,
        w: 76,
        period: 3.4,
        warningDuration: 0.85,
        firingDuration: 0.62,
        phase: 0.25,
      },
      {
        x: 3415,
        y: 606,
        w: 76,
        period: 3.65,
        warningDuration: 0.9,
        firingDuration: 0.65,
        phase: 1.7,
      },
    ],
    enemies: [
      enemySpawn(0, 470, 470, 420, 550, 78, 0, 0),
      enemySpawn(1, 900, 470, 850, 960, -82, 0.55, 1, 11),
      enemySpawn(2, 1370, 455, 1310, 1440, 84, 1.1, 2),
      enemySpawn(3, 2110, 440, 2070, 2220, -80, 1.65, 3),
      enemySpawn(4, 2680, 410, 2640, 2790, 86, 2.2, 4),
      enemySpawn(5, 3030, 485, 2990, 3090, -82, 2.75, 5, 18),
      enemySpawn(6, 3250, 420, 3220, 3320, 88, 3.3, 6),
      enemySpawn(7, 4130, 390, 4090, 4240, -84, 3.85, 7),
      enemySpawn(8, 4690, 465, 4650, 4760, 88, 4.4, 8, 23),
      enemySpawn(9, 5670, 430, 5630, 5780, -86, 4.95, 9),
    ],
  },
];

const createEnemies = (levelIndex = 0): Enemy[] =>
  LEVEL_LAYOUTS[levelIndex].enemies.map((enemy) => {
    const platformIndex = enemy.ridingPlatformIndex;
    if (platformIndex === undefined) {
      return { ...enemy, active: true };
    }
    const basePlatform = LEVEL_LAYOUTS[levelIndex].platforms[platformIndex];
    const resolvedPlatform = platformAtTime(basePlatform, 0);
    const dx = resolvedPlatform.x - basePlatform.x;
    const dy = resolvedPlatform.y - basePlatform.y;
    return {
      ...enemy,
      x: enemy.x + dx,
      y: enemy.y + dy,
      minX: enemy.minX + dx,
      maxX: enemy.maxX + dx,
      active: true,
    };
  });

const createBonusCrate = (levelIndex = 0): BonusCrate | null =>
  LEVELS[levelIndex].number % BONUS_LEVEL_INTERVAL === 0
    ? {
        x: 2010,
        y: 520,
        w: 58,
        h: 58,
        collected: false,
        pulse: 0,
      }
    : null;

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

  if (platform.motion) {
    const centerX = x + platform.w / 2;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = "#61efff";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(124, 244, 255, .9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x + 8, platform.y + 6, platform.w - 16, 10);
    ctx.setLineDash([]);
    ctx.fillStyle = "#d9fcff";
    ctx.beginPath();
    if (platform.motion.axis === "x") {
      ctx.moveTo(centerX - 22, platform.y + 17);
      ctx.lineTo(centerX - 32, platform.y + 12);
      ctx.lineTo(centerX - 22, platform.y + 7);
      ctx.moveTo(centerX + 22, platform.y + 17);
      ctx.lineTo(centerX + 32, platform.y + 12);
      ctx.lineTo(centerX + 22, platform.y + 7);
    } else {
      ctx.moveTo(centerX, platform.y + 5);
      ctx.lineTo(centerX - 6, platform.y + 12);
      ctx.lineTo(centerX + 6, platform.y + 12);
      ctx.moveTo(centerX, platform.y + 19);
      ctx.lineTo(centerX - 6, platform.y + 12);
      ctx.lineTo(centerX + 6, platform.y + 12);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function platformAtTime(platform: Platform, time: number): Platform {
  if (!platform.motion) return platform;
  const offset =
    Math.sin(
      (time / platform.motion.period) * Math.PI * 2 +
        (platform.motion.phase ?? 0),
    ) * platform.motion.distance;
  return {
    ...platform,
    x: platform.x + (platform.motion.axis === "x" ? offset : 0),
    y: platform.y + (platform.motion.axis === "y" ? offset : 0),
  };
}

function energyTrapState(
  trap: EnergyTrap,
  time: number,
): { mode: "idle" | "warning" | "firing"; progress: number } {
  const cycle = ((time + trap.phase) % trap.period + trap.period) % trap.period;
  const warningStart =
    trap.period - trap.warningDuration - trap.firingDuration;
  const firingStart = trap.period - trap.firingDuration;
  if (cycle >= firingStart) {
    return {
      mode: "firing",
      progress: (cycle - firingStart) / trap.firingDuration,
    };
  }
  if (cycle >= warningStart) {
    return {
      mode: "warning",
      progress: (cycle - warningStart) / trap.warningDuration,
    };
  }
  return { mode: "idle", progress: cycle / warningStart };
}

function drawEnergyTrap(
  ctx: CanvasRenderingContext2D,
  trap: EnergyTrap,
  cameraX: number,
  time: number,
) {
  const x = trap.x - cameraX;
  if (x > VIEW_W + 100 || x + trap.w < -100) return;
  const state = energyTrapState(trap, time);
  const centerX = x + trap.w / 2;
  const pulse = (Math.sin(time * 14) + 1) / 2;

  ctx.save();
  const baseGradient = ctx.createLinearGradient(x, 0, x + trap.w, 0);
  baseGradient.addColorStop(0, "#07111d");
  baseGradient.addColorStop(
    0.24,
    state.mode === "firing" ? "#f7faff" : "#ff6a27",
  );
  baseGradient.addColorStop(
    0.5,
    state.mode === "idle" ? "#36dced" : "#fff4b5",
  );
  baseGradient.addColorStop(
    0.76,
    state.mode === "firing" ? "#f7faff" : "#ff6a27",
  );
  baseGradient.addColorStop(1, "#07111d");
  ctx.fillStyle = baseGradient;
  ctx.shadowColor =
    state.mode === "firing"
      ? "#d9fbff"
      : state.mode === "warning"
        ? "#ff712c"
        : "#35ddef";
  ctx.shadowBlur =
    state.mode === "warning" ? 14 + pulse * 16 : state.mode === "firing" ? 28 : 8;
  roundedRect(ctx, x, trap.y - 13, trap.w, 18, 5);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle =
    state.mode === "warning" ? "#fff2b0" : "rgba(206, 251, 255, .9)";
  for (let marker = 0; marker < 3; marker++) {
    const markerX = x + 16 + marker * ((trap.w - 32) / 2);
    ctx.beginPath();
    ctx.moveTo(markerX, trap.y - 10);
    ctx.lineTo(markerX + 5, trap.y - 3);
    ctx.lineTo(markerX - 5, trap.y - 3);
    ctx.closePath();
    ctx.fill();
  }

  if (state.mode === "warning") {
    const warningAlpha = 0.3 + state.progress * 0.55 + pulse * 0.15;
    ctx.globalCompositeOperation = "screen";
    const warningBeam = ctx.createLinearGradient(0, 170, 0, trap.y);
    warningBeam.addColorStop(0, "rgba(255, 110, 35, 0)");
    warningBeam.addColorStop(
      0.72,
      `rgba(255, 105, 35, ${warningAlpha * 0.24})`,
    );
    warningBeam.addColorStop(
      1,
      `rgba(255, 227, 139, ${warningAlpha * 0.72})`,
    );
    ctx.fillStyle = warningBeam;
    ctx.fillRect(x + 14, 170, trap.w - 28, trap.y - 170);
    ctx.strokeStyle = `rgba(255, 235, 168, ${warningAlpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 12]);
    ctx.strokeRect(x + 9, 170, trap.w - 18, trap.y - 170);
    ctx.setLineDash([]);
  }

  if (state.mode === "firing") {
    const beamTop = 110;
    const surge =
      Math.sin(state.progress * Math.PI) *
      (0.86 + Math.sin(time * 36) * 0.12);
    ctx.globalCompositeOperation = "screen";
    const beam = ctx.createLinearGradient(x, 0, x + trap.w, 0);
    beam.addColorStop(0, "rgba(32, 213, 255, 0)");
    beam.addColorStop(0.16, `rgba(63, 221, 255, ${0.46 + surge * 0.3})`);
    beam.addColorStop(0.42, `rgba(235, 253, 255, ${0.82 + surge * 0.16})`);
    beam.addColorStop(0.58, `rgba(255, 255, 255, ${0.9 + surge * 0.1})`);
    beam.addColorStop(0.84, `rgba(63, 221, 255, ${0.46 + surge * 0.3})`);
    beam.addColorStop(1, "rgba(32, 213, 255, 0)");
    ctx.fillStyle = beam;
    ctx.shadowColor = "#9df6ff";
    ctx.shadowBlur = 28 + surge * 18;
    ctx.fillRect(x - 6, beamTop, trap.w + 12, trap.y - beamTop);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255,255,255,.94)";
    ctx.lineWidth = 3;
    for (let arc = 0; arc < 3; arc++) {
      ctx.beginPath();
      ctx.moveTo(centerX, trap.y);
      for (let py = trap.y; py >= beamTop; py -= 22) {
        ctx.lineTo(
          centerX +
            Math.sin(py * 0.08 + time * (18 + arc * 2) + arc * 2.4) *
              (10 + arc * 6),
          py,
        );
      }
      ctx.stroke();
    }
  }
  ctx.restore();
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
  const damageGlow =
    player.invulnerable > 0
      ? Math.max(0.38, Math.min(1, player.invulnerable / 0.85))
      : 0;
  const damagePulse =
    damageGlow * (0.86 + Math.sin(player.runClock * 28) * 0.14);

  ctx.save();
  ctx.translate(x, player.y + player.h);
  ctx.scale(player.facing, 1);
  ctx.shadowColor =
    damageGlow > 0
      ? `rgba(255, 8, 54, ${0.82 + damagePulse * 0.18})`
      : "rgba(255, 139, 24, .48)";
  ctx.shadowBlur = 16 + damagePulse * 42;
  if (damageGlow > 0) {
    ctx.filter = [
      `drop-shadow(0 0 ${3 + damagePulse * 3}px rgba(255, 220, 226, ${damagePulse * 0.9}))`,
      `drop-shadow(0 0 ${10 + damagePulse * 8}px rgba(255, 8, 54, ${damagePulse}))`,
      `drop-shadow(0 0 ${24 + damagePulse * 14}px rgba(190, 0, 38, ${damagePulse * 0.9}))`,
    ].join(" ");
  }

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

function drawDamageBurst(
  ctx: CanvasRenderingContext2D,
  burst: DamageBurst,
  cameraX: number,
) {
  if (burst.time <= 0) return;
  const progress = 1 - burst.time / burst.duration;
  const alpha = Math.pow(Math.max(0, 1 - progress), 1.35);
  const x = burst.x - cameraX;

  ctx.save();
  ctx.translate(x, burst.y);
  ctx.globalCompositeOperation = "screen";

  const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 112 + progress * 42);
  glow.addColorStop(0, `rgba(255, 235, 240, ${alpha * 0.72})`);
  glow.addColorStop(0.18, `rgba(255, 28, 70, ${alpha * 0.6})`);
  glow.addColorStop(0.52, `rgba(190, 0, 38, ${alpha * 0.24})`);
  glow.addColorStop(1, "rgba(120, 0, 28, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 124 + progress * 42, 0, Math.PI * 2);
  ctx.fill();

  for (let ring = 0; ring < 2; ring++) {
    ctx.strokeStyle =
      ring === 0
        ? `rgba(255, 79, 105, ${alpha * 0.9})`
        : `rgba(255, 210, 218, ${alpha * 0.56})`;
    ctx.lineWidth = Math.max(1.5, 8 - progress * 5 - ring * 2);
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      28 + progress * (108 + ring * 30),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawTailDust(
  ctx: CanvasRenderingContext2D,
  dust: TailDust[],
  cameraX: number,
  front: boolean,
) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const mote of dust) {
    if (mote.front !== front) continue;
    const life = Math.max(0, mote.life / mote.maxLife);
    const alpha = Math.min(1, life * 1.8);
    const x = mote.x - cameraX;

    ctx.save();
    ctx.translate(x, mote.y);
    ctx.rotate(mote.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = mote.kind === "pixel" ? "#dffaff" : "#ffffff";
    ctx.shadowColor = mote.kind === "diamond" ? "#ffffff" : "#8feeff";
    ctx.shadowBlur = 5 + mote.size * 1.8;

    if (mote.kind === "cross") {
      ctx.fillRect(-mote.size * 1.55, -mote.size * 0.28, mote.size * 3.1, mote.size * 0.56);
      ctx.fillRect(-mote.size * 0.28, -mote.size * 1.55, mote.size * 0.56, mote.size * 3.1);
    } else if (mote.kind === "diamond") {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-mote.size / 2, -mote.size / 2, mote.size, mote.size);
    } else {
      ctx.fillRect(-mote.size / 2, -mote.size / 2, mote.size, mote.size);
    }
    ctx.restore();
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
  const platformY = enemy.y + enemy.h;
  const pulse = 1 + Math.sin(enemy.pulse * 5) * 0.06;

  ctx.save();
  ctx.translate(x, platformY);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#ff2a74";
  ctx.shadowBlur = 24;
  if (sprite?.complete && sprite.naturalWidth > 0) {
    const maxDrawWidth = 152;
    const maxDrawHeight = 120;
    const drawScale = Math.min(
      maxDrawWidth / sprite.naturalWidth,
      maxDrawHeight / sprite.naturalHeight,
    );
    const drawWidth = sprite.naturalWidth * drawScale;
    const drawHeight = sprite.naturalHeight * drawScale;
    ctx.drawImage(
      sprite,
      -drawWidth / 2,
      -drawHeight,
      drawWidth,
      drawHeight,
    );
  } else {
    ctx.fillStyle = "#ff315f";
    roundedRect(ctx, -29, -58, 58, 46, 9);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBonusCrate(
  ctx: CanvasRenderingContext2D,
  crate: BonusCrate,
  cameraX: number,
  sprite?: HTMLImageElement,
) {
  if (crate.collected) return;
  const x = crate.x - cameraX + crate.w / 2;
  if (x < -100 || x > VIEW_W + 100) return;
  const bob = Math.sin(crate.pulse * 3.4) * 7;
  const pulse = 1 + Math.sin(crate.pulse * 5.2) * 0.045;

  ctx.save();
  ctx.translate(x, crate.y + crate.h / 2 + bob);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#55efff";
  ctx.shadowBlur = 26;
  if (sprite?.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, -48, -48, 96, 96);
  } else {
    ctx.fillStyle = "#0b2941";
    roundedRect(ctx, -29, -29, 58, 58, 8);
    ctx.fill();
    ctx.fillStyle = "#6ff3ff";
    ctx.font = "900 34px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", 0, 1);
  }
  ctx.restore();
}

function drawBonusBurst(
  ctx: CanvasRenderingContext2D,
  burst: BonusBurst,
  cameraX: number,
) {
  const progress = 1 - burst.time / 1.5;
  const alpha = Math.min(1, burst.time * 2.4);
  const x = burst.x - cameraX;
  const y = burst.y - progress * 62;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(0.82 + Math.min(0.18, progress * 0.5), 0.82 + Math.min(0.18, progress * 0.5));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "italic 900 26px Impact, 'Arial Black', sans-serif";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(2, 8, 17, .9)";
  ctx.strokeText("+1 INTEGRITY!", 0, 0);
  ctx.fillStyle = "#efffff";
  ctx.shadowColor = "#4deaff";
  ctx.shadowBlur = 18;
  ctx.fillText("+1 INTEGRITY!", 0, 0);
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
  exitFieldX = EXIT_FIELD_X,
) {
  const x = exitFieldX - cameraX;
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
  const controlStateRef = useRef(createControlState());
  const jumpLatchRef = useRef(false);
  const jumpPointerRef = useRef<number | null>(null);
  const mobileJumpSfxRef = useRef(false);
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
  const enemiesRef = useRef<Enemy[]>(createEnemies(0));
  const bonusCrateRef = useRef<BonusCrate | null>(createBonusCrate(0));
  const bonusBurstRef = useRef<BonusBurst | null>(null);
  const safePositionRef = useRef({ x: 150, y: 516 });
  const standingPlatformRef = useRef<number | null>(0);
  const capturedEnemyRef = useRef<Enemy | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const damageBurstRef = useRef<DamageBurst | null>(null);
  const tailDustRef = useRef<TailDust[]>([]);
  const tailDustClockRef = useRef(0);
  const tailDustSerialRef = useRef(0);
  const cameraRef = useRef(0);
  const captureTimeRef = useRef(0);
  const fieldUnlockStartedRef = useRef<number | null>(null);
  const factTimerRef = useRef<number | null>(null);
  const factShownAtRef = useRef(0);
  const factVisibleRef = useRef(false);
  const factDismissingRef = useRef(false);
  const quizAdvanceTimerRef = useRef<number | null>(null);
  const quizQuestionIndexRef = useRef(0);
  const quizAnswerIndexRef = useRef<number | null>(null);
  const quizScoreRef = useRef(0);
  const [scene, setScene] = useState<Scene>("splash");
  const [levelIndex, setLevelIndex] = useState(0);
  const [health, setHealth] = useState(STARTING_INTEGRITY);
  const healthRef = useRef(STARTING_INTEGRITY);
  const [captured, setCaptured] = useState(0);
  const [callout, setCallout] = useState(false);
  const [calloutDismissing, setCalloutDismissing] = useState(false);
  const [factLessonIndex, setFactLessonIndex] = useState(0);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizAnswerIndex, setQuizAnswerIndex] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);

  const preloadLevelBackground = useCallback((targetLevelIndex: number) => {
    if (targetLevelIndex < 0 || targetLevelIndex >= LEVELS.length) return;

    const backgrounds =
      artRef.current.backgrounds ??
      Array<HTMLImageElement | undefined>(LEVELS.length);
    artRef.current.backgrounds = backgrounds;
    if (backgrounds[targetLevelIndex]) return;

    const image = new Image();
    image.decoding = "async";
    image.src = LEVELS[targetLevelIndex].background;
    backgrounds[targetLevelIndex] = image;
  }, []);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const musicRef = useRef<Partial<Record<MusicTrackKey, HTMLAudioElement>>>({});
  const musicHealthRef = useRef<ReturnType<
    typeof createMusicHealthMonitor
  > | null>(null);
  const sfxRef = useRef<Partial<Record<SfxKey, HTMLAudioElement>>>({});
  const activeSfxRef = useRef(new Map<HTMLAudioElement, SfxKey>());
  const laserFiringRef = useRef<boolean[]>([]);
  const activeMusicRef = useRef<MusicTrackKey | null>(null);
  const desiredMusicRef = useRef<MusicTrackKey | null>(null);
  const musicEnvelopeRef = useRef(
    new Map<MusicTrackKey, number>(
      (Object.keys(MUSIC_SOURCES) as MusicTrackKey[]).map((key) => [key, 0]),
    ),
  );
  const musicFadeRef = useRef(new Map<MusicTrackKey, number>());
  const titleTransitionTimerRef = useRef<number | null>(null);

  const syncInputFromSources = useCallback(() => {
    inputRef.current = getControlInput(controlStateRef.current);
  }, []);

  const releaseAllInputs = useCallback(() => {
    clearControlState(controlStateRef.current);
    inputRef.current = { left: false, right: false, jump: false };
    jumpLatchRef.current = false;
    jumpPointerRef.current = null;
    mobileJumpSfxRef.current = false;
  }, []);

  const clearFactCallout = useCallback(() => {
    if (factTimerRef.current !== null) {
      window.clearTimeout(factTimerRef.current);
      factTimerRef.current = null;
    }
    factVisibleRef.current = false;
    factDismissingRef.current = false;
    setCallout(false);
    setCalloutDismissing(false);
  }, []);

  const showFactCallout = useCallback(() => {
    if (factTimerRef.current !== null) {
      window.clearTimeout(factTimerRef.current);
    }
    factShownAtRef.current = performance.now();
    factVisibleRef.current = true;
    factDismissingRef.current = false;
    setCalloutDismissing(false);
    setCallout(true);
    factTimerRef.current = window.setTimeout(() => {
      factVisibleRef.current = false;
      setCallout(false);
      factTimerRef.current = null;
    }, FACT_CALLOUT_TOTAL_MS);
  }, []);

  const dismissFactCalloutForMovement = useCallback(() => {
    if (!factVisibleRef.current || factDismissingRef.current) return;
    if (factTimerRef.current !== null) {
      window.clearTimeout(factTimerRef.current);
    }
    factDismissingRef.current = true;
    setCalloutDismissing(true);
    factTimerRef.current = window.setTimeout(() => {
      factVisibleRef.current = false;
      factDismissingRef.current = false;
      setCallout(false);
      setCalloutDismissing(false);
      factTimerRef.current = null;
    }, FACT_CALLOUT_DISMISS_MS);
  }, []);

  const resetQuiz = useCallback(() => {
    if (quizAdvanceTimerRef.current !== null) {
      window.clearTimeout(quizAdvanceTimerRef.current);
      quizAdvanceTimerRef.current = null;
    }
    quizQuestionIndexRef.current = 0;
    quizAnswerIndexRef.current = null;
    quizScoreRef.current = 0;
    setQuizQuestionIndex(0);
    setQuizAnswerIndex(null);
    setQuizScore(0);
  }, []);

  const setMusicEnvelope = useCallback(
    (key: MusicTrackKey, volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      musicEnvelopeRef.current.set(key, clampedVolume);
      const track = musicRef.current[key];
      if (track) {
        track.volume = mutedRef.current ? 0 : clampedVolume;
        track.muted = mutedRef.current || clampedVolume <= 0;
      }
    },
    [],
  );

  const fadeMusic = useCallback(
    (
      key: MusicTrackKey,
      targetVolume: number,
      duration: number,
      onComplete?: () => void,
    ) => {
      const existingFade = musicFadeRef.current.get(key);
      if (existingFade !== undefined) {
        window.cancelAnimationFrame(existingFade);
      }

      const startingVolume = musicEnvelopeRef.current.get(key) ?? 0;
      if (duration <= 0) {
        setMusicEnvelope(key, targetVolume);
        musicFadeRef.current.delete(key);
        onComplete?.();
        return;
      }

      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        setMusicEnvelope(
          key,
          startingVolume + (targetVolume - startingVolume) * easedProgress,
        );
        if (progress < 1) {
          musicFadeRef.current.set(key, window.requestAnimationFrame(tick));
          return;
        }
        musicFadeRef.current.delete(key);
        onComplete?.();
      };

      musicFadeRef.current.set(key, window.requestAnimationFrame(tick));
    },
    [setMusicEnvelope],
  );

  const enforceSingleMusicTrack = useCallback(
    (desiredTrack: MusicTrackKey) => {
      (Object.keys(MUSIC_SOURCES) as MusicTrackKey[]).forEach((key) => {
        if (key === desiredTrack) return;
        const track = musicRef.current[key];
        const fade = musicFadeRef.current.get(key);
        if (fade !== undefined) {
          window.cancelAnimationFrame(fade);
          musicFadeRef.current.delete(key);
        }
        track?.pause();
        if (track) {
          track.currentTime = 0;
          track.muted = true;
        }
        setMusicEnvelope(key, 0);
      });
    },
    [setMusicEnvelope],
  );

  const transitionMusic = useCallback(
    (
      nextTrack: MusicTrackKey | null,
      options: {
        fadeOut?: number;
        fadeIn?: number;
        restart?: boolean;
      } = {},
    ) => {
      const {
        fadeOut = 850,
        fadeIn = 900,
        restart = false,
      } = options;
      const previousTrack = activeMusicRef.current;
      desiredMusicRef.current = nextTrack;

      // Enforce a one-transition-at-a-time mixer. Any track that is neither
      // the outgoing nor incoming song is stopped and muted immediately.
      (Object.keys(MUSIC_SOURCES) as MusicTrackKey[]).forEach((key) => {
        if (key === previousTrack || key === nextTrack) return;
        const inactiveAudio = musicRef.current[key];
        const inactiveFade = musicFadeRef.current.get(key);
        if (inactiveFade !== undefined) {
          window.cancelAnimationFrame(inactiveFade);
          musicFadeRef.current.delete(key);
        }
        inactiveAudio?.pause();
        if (inactiveAudio) {
          inactiveAudio.currentTime = 0;
          inactiveAudio.muted = true;
        }
        setMusicEnvelope(key, 0);
      });

      if (previousTrack && previousTrack !== nextTrack) {
        const previousAudio = musicRef.current[previousTrack];
        fadeMusic(previousTrack, 0, fadeOut, () => {
          if (desiredMusicRef.current !== previousTrack) {
            previousAudio?.pause();
            if (previousAudio) previousAudio.muted = true;
          }
        });
      }

      if (!nextTrack) {
        activeMusicRef.current = null;
        return;
      }

      const nextAudio = musicRef.current[nextTrack];
      if (!nextAudio) return;
      nextAudio.muted = mutedRef.current;
      const isNewTrack = previousTrack !== nextTrack;
      if (restart) {
        nextAudio.currentTime = 0;
      }
      if (isNewTrack || restart) {
        setMusicEnvelope(nextTrack, 0);
      }
      activeMusicRef.current = nextTrack;
      // transitionMusic already owns the outgoing/incoming fade pair. Let the
      // health monitor start the new song without cutting that crossfade short.
      void musicHealthRef.current?.ensure({ enforce: false });
      fadeMusic(nextTrack, MUSIC_VOLUME, fadeIn);
    },
    [fadeMusic, setMusicEnvelope],
  );

  const unlockMusic = useCallback(() => {
    // User gestures retry autoplay rejection and also recover a desired track
    // whose media clock stopped despite paused remaining false.
    void musicHealthRef.current?.ensure({ gesture: true });
  }, []);

  const playSfx = useCallback((key: SfxKey) => {
    if (mutedRef.current || typeof window === "undefined") return;
    const source = sfxRef.current[key];
    if (!source) return;

    const voice = source.cloneNode(true) as HTMLAudioElement;
    voice.preload = "auto";
    voice.muted = false;
    voice.volume = SFX_SOURCES[key].volume;
    const releaseVoice = () => {
      activeSfxRef.current.delete(voice);
      voice.removeEventListener("ended", releaseVoice);
      voice.removeEventListener("error", releaseVoice);
    };
    voice.addEventListener("ended", releaseVoice);
    voice.addEventListener("error", releaseVoice);
    activeSfxRef.current.set(voice, key);
    void voice.play().catch(releaseVoice);
  }, []);

  const triggerDamageEffect = useCallback((player: Player) => {
    const x = player.x + player.w / 2;
    const y = player.y + player.h * 0.48;
    damageBurstRef.current = {
      x,
      y,
      time: 0.58,
      duration: 0.58,
    };

    const colors = ["#ff164f", "#ff4168", "#d9003b", "#ff97aa"];
    for (let i = 0; i < 34; i++) {
      const angle = (Math.PI * 2 * i) / 34 + (i % 3) * 0.08;
      const speed = 115 + (i % 7) * 23;
      particlesRef.current.push({
        x: x + Math.cos(angle) * (8 + (i % 4) * 3),
        y: y + Math.sin(angle) * (8 + (i % 5) * 2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 45,
        life: 0.46 + (i % 5) * 0.045,
        color: colors[i % colors.length],
        size: 6 + (i % 6) * 1.55,
      });
    }
  }, []);

  const triggerGameOver = useCallback(() => {
    if (sceneRef.current !== "playing") return;
    releaseAllInputs();
    clearFactCallout();
    sceneRef.current = "gameOver";
    setScene("gameOver");
    playSfx("gameOver");
  }, [clearFactCallout, playSfx, releaseAllInputs]);

  const resetGame = useCallback((nextLevelIndex = 0) => {
    clearFactCallout();
    resetQuiz();
    releaseAllInputs();
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
    enemiesRef.current = createEnemies(nextLevelIndex);
    bonusCrateRef.current = createBonusCrate(nextLevelIndex);
    bonusBurstRef.current = null;
    safePositionRef.current = { x: 150, y: 516 };
    standingPlatformRef.current = 0;
    capturedEnemyRef.current = null;
    particlesRef.current = [];
    damageBurstRef.current = null;
    tailDustRef.current = [];
    tailDustClockRef.current = 0;
    tailDustSerialRef.current = 0;
    laserFiringRef.current = [];
    cameraRef.current = 0;
    captureTimeRef.current = 0;
    fieldUnlockStartedRef.current = null;
    healthRef.current = STARTING_INTEGRITY;
    setHealth(STARTING_INTEGRITY);
    setCaptured(0);
    setFactLessonIndex(0);
  }, [clearFactCallout, releaseAllInputs, resetQuiz]);

  const startLevel = useCallback((nextLevelIndex: number) => {
    if (titleTransitionTimerRef.current !== null) {
      window.clearTimeout(titleTransitionTimerRef.current);
      titleTransitionTimerRef.current = null;
    }
    preloadLevelBackground(nextLevelIndex);
    resetGame(nextLevelIndex);
    transitionMusic(musicForLevel(nextLevelIndex), {
      fadeOut: 900,
      fadeIn: 1100,
      restart: true,
    });
    levelIndexRef.current = nextLevelIndex;
    setLevelIndex(nextLevelIndex);
    sceneRef.current = "levelIntro";
    setScene("levelIntro");
    playSfx("nextLevel");
  }, [playSfx, preloadLevelBackground, resetGame, transitionMusic]);

  const startCampaign = useCallback(() => {
    startLevel(0);
  }, [startLevel]);

  const showInstructions = useCallback(() => {
    sceneRef.current = "instructions";
    setScene("instructions");
  }, []);

  const returnToTitle = useCallback(() => {
    sceneRef.current = "title";
    setScene("title");
  }, []);

  const enterTitle = useCallback(() => {
    if (sceneRef.current !== "splash") return;
    transitionMusic("title", {
      fadeOut: 0,
      fadeIn: 0,
      restart: true,
    });
    unlockMusic();
    sceneRef.current = "title";
    titleTransitionTimerRef.current = window.setTimeout(() => {
      titleTransitionTimerRef.current = null;
      setScene("title");
    }, 160);
  }, [transitionMusic, unlockMusic]);

  const advanceCampaign = useCallback(() => {
    const nextLevelIndex = levelIndexRef.current + 1;
    if (nextLevelIndex < LEVELS.length) {
      startLevel(nextLevelIndex);
      return;
    }
    resetGame(0);
    levelIndexRef.current = 0;
    setLevelIndex(0);
    sceneRef.current = "title";
    setScene("title");
  }, [resetGame, startLevel]);

  const replayCurrentLevel = useCallback(() => {
    startLevel(levelIndexRef.current);
  }, [startLevel]);

  const advanceQuizFeedback = useCallback(() => {
    if (
      sceneRef.current !== "quiz" ||
      quizAnswerIndexRef.current === null
    ) {
      return false;
    }

    if (quizAdvanceTimerRef.current !== null) {
      window.clearTimeout(quizAdvanceTimerRef.current);
      quizAdvanceTimerRef.current = null;
    }
    quizAnswerIndexRef.current = null;
    setQuizAnswerIndex(null);

    const questions = buildLevelQuiz(LEVELS, levelIndexRef.current);
    const nextQuestion = quizQuestionIndexRef.current + 1;
    if (nextQuestion < questions.length) {
      quizQuestionIndexRef.current = nextQuestion;
      setQuizQuestionIndex(nextQuestion);
      return true;
    }

    const completedCampaign =
      levelIndexRef.current === LEVELS.length - 1;
    sceneRef.current = completedCampaign ? "winner" : "complete";
    setScene(completedCampaign ? "winner" : "complete");
    playSfx("levelComplete");
    return true;
  }, [playSfx]);

  const answerQuiz = useCallback(
    (answerIndex: number) => {
      if (
        sceneRef.current !== "quiz" ||
        quizAnswerIndexRef.current !== null
      ) {
        return;
      }
      const questions = buildLevelQuiz(LEVELS, levelIndexRef.current);
      const question = questions[quizQuestionIndexRef.current];
      if (!question || answerIndex < 0 || answerIndex >= question.options.length) {
        return;
      }

      quizAnswerIndexRef.current = answerIndex;
      setQuizAnswerIndex(answerIndex);
      const correct = answerIndex === question.correctIndex;
      if (correct) {
        quizScoreRef.current += 1;
        setQuizScore(quizScoreRef.current);
      }
      playSfx(correct ? "powerUp" : "playerHit");

      if (quizAdvanceTimerRef.current !== null) {
        window.clearTimeout(quizAdvanceTimerRef.current);
      }
      quizAdvanceTimerRef.current = window.setTimeout(
        advanceQuizFeedback,
        QUIZ_FEEDBACK_MS,
      );
    },
    [advanceQuizFeedback, playSfx],
  );

  useEffect(() => {
    sceneRef.current = scene;
    if (scene !== "playing") releaseAllInputs();
  }, [releaseAllInputs, scene]);

  useEffect(() => {
    const tracks = Object.fromEntries(
      (Object.entries(MUSIC_SOURCES) as [MusicTrackKey, string][]).map(
        ([key, source]) => {
          const track = new Audio();
          track.loop = true;
          track.preload =
            key === "title" || key === "levelOne" ? "auto" : "metadata";
          track.volume = 0;
          track.src = source;
          if (key === "title") track.load();
          return [key, track];
        },
      ),
    ) as Record<MusicTrackKey, HTMLAudioElement>;
    musicRef.current = tracks;
    const musicHealth = createMusicHealthMonitor({
      tracks,
      getDesiredKey: () => desiredMusicRef.current,
      isMuted: () => mutedRef.current,
      isVisible: () => document.visibilityState === "visible",
      enforceSingleTrack: (key) =>
        enforceSingleMusicTrack(key as MusicTrackKey),
    });
    musicHealthRef.current = musicHealth;
    musicHealth.start();
    const musicFades = musicFadeRef.current;

    return () => {
      if (titleTransitionTimerRef.current !== null) {
        window.clearTimeout(titleTransitionTimerRef.current);
        titleTransitionTimerRef.current = null;
      }
      musicHealth.stop();
      musicHealthRef.current = null;
      musicFades.forEach((frame) =>
        window.cancelAnimationFrame(frame),
      );
      musicFades.clear();
      Object.values(tracks).forEach((track) => {
        track.pause();
        track.removeAttribute("src");
        track.load();
      });
      musicRef.current = {};
    };
  }, [enforceSingleMusicTrack]);

  useEffect(() => {
    const clips = Object.fromEntries(
      (Object.entries(SFX_SOURCES) as [
        SfxKey,
        { source: string; volume: number },
      ][]).map(([key, config]) => {
        const clip = new Audio();
        clip.preload = "auto";
        clip.src = config.source;
        clip.load();
        return [key, clip];
      }),
    ) as Record<SfxKey, HTMLAudioElement>;
    sfxRef.current = clips;
    const activeSfx = activeSfxRef.current;

    return () => {
      activeSfx.forEach((_key, voice) => {
        voice.pause();
        voice.removeAttribute("src");
        voice.load();
      });
      activeSfx.clear();
      Object.values(clips).forEach((clip) => {
        clip.pause();
        clip.removeAttribute("src");
        clip.load();
      });
      sfxRef.current = {};
    };
  }, []);

  useEffect(() => {
    const load = (src: string) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      return image;
    };
    artRef.current = {
      backgrounds: Array<HTMLImageElement | undefined>(LEVELS.length),
      runFrames: Array.from({ length: 7 }, (_, frame) =>
        load(`./assets/praxi-run-v5/praxi-run-${frame}.png`),
      ),
      ready: load("./assets/praxi-idle-v6.png"),
      jump: load("./assets/praxi-jump-v6.png"),
      enemies: LEVELS.map((level) => load(level.enemy)),
      bonusCrate: load("./assets/integrity-crate-v1.png"),
    };
    preloadLevelBackground(0);
  }, [preloadLevelBackground]);

  useEffect(() => {
    if (scene !== "quiz") return;
    preloadLevelBackground(levelIndex + 1);
  }, [levelIndex, preloadLevelBackground, scene]);

  useEffect(() => {
    mutedRef.current = muted;
    (Object.keys(MUSIC_SOURCES) as MusicTrackKey[]).forEach((key) => {
      const track = musicRef.current[key];
      if (track) {
        const envelope = musicEnvelopeRef.current.get(key) ?? 0;
        track.volume = muted
          ? 0
          : envelope;
        track.muted =
          muted ||
          (key !== activeMusicRef.current && envelope <= 0);
      }
    });
    activeSfxRef.current.forEach((key, voice) => {
      voice.muted = muted;
      voice.volume = muted ? 0 : SFX_SOURCES[key].volume;
    });
    if (!muted) unlockMusic();
  }, [muted, unlockMusic]);

  useEffect(() => {
    const handleMusicUnlock = () => unlockMusic();
    window.addEventListener("keydown", handleMusicUnlock, { capture: true });
    window.addEventListener("pointerdown", handleMusicUnlock, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("keydown", handleMusicUnlock, {
        capture: true,
      });
      window.removeEventListener("pointerdown", handleMusicUnlock, {
        capture: true,
      });
    };
  }, [unlockMusic]);

  useEffect(() => {
    const restoreMusic = () => {
      if (document.visibilityState === "visible") {
        void musicHealthRef.current?.restore();
      }
    };
    document.addEventListener("visibilitychange", restoreMusic);
    window.addEventListener("pageshow", restoreMusic);
    window.addEventListener("focus", restoreMusic);
    return () => {
      document.removeEventListener("visibilitychange", restoreMusic);
      window.removeEventListener("pageshow", restoreMusic);
      window.removeEventListener("focus", restoreMusic);
    };
  }, []);

  useEffect(() => {
    if (scene === "splash") {
      transitionMusic(null, { fadeOut: 0 });
      return;
    }
    if (scene === "title" || scene === "instructions") {
      transitionMusic("title", {
        fadeOut: scene === "instructions" ? 0 : 650,
        fadeIn: scene === "instructions" ? 0 : 1100,
        restart: activeMusicRef.current !== "title",
      });
      return;
    }
    if (scene === "levelIntro") {
      const levelTrack = musicForLevel(levelIndex);
      if (activeMusicRef.current !== levelTrack) {
        transitionMusic(levelTrack, {
          fadeOut: 900,
          fadeIn: 1100,
          restart: false,
        });
      }
      return;
    }
    if (scene === "playing") {
      transitionMusic(musicForLevel(levelIndex), {
        fadeOut: 700,
        fadeIn: 500,
      });
      return;
    }
    if (scene === "quiz") {
      // Keep the level soundtrack running through the fast mission debrief.
      transitionMusic(musicForLevel(levelIndex), {
        fadeOut: 0,
        fadeIn: 0,
      });
      return;
    }
    if (scene === "complete") {
      transitionMusic(null, { fadeOut: 900 });
      return;
    }
    if (scene === "winner") {
      // Preserve the Gauntlet reprise at its current position throughout the
      // victory celebration; the Praxen screen inherits the same active track.
      transitionMusic(musicForLevel(levelIndex), {
        fadeOut: 0,
        fadeIn: 0,
      });
      return;
    }
    if (scene === "gameOver") {
      transitionMusic("gameOver", {
        fadeOut: 950,
        fadeIn: 900,
        restart: true,
      });
    }
    // The Praxen screen keeps whichever route brought us here: the Game Over
    // theme after a loss, or the Gauntlet reprise after a campaign victory.
  }, [levelIndex, scene, transitionMusic]);

  useEffect(() => {
    if (scene !== "levelIntro") return;

    const beginLevel = window.setTimeout(() => {
      sceneRef.current = "playing";
      setScene("playing");
    }, 3400);

    return () => {
      window.clearTimeout(beginLevel);
    };
  }, [scene]);

  useEffect(() => {
    if (scene !== "gameOver") return;

    const showPraxen = window.setTimeout(() => {
      sceneRef.current = "praxenAd";
      setScene("praxenAd");
    }, 3450);

    return () => {
      window.clearTimeout(showPraxen);
    };
  }, [scene]);

  useEffect(() => {
    if (scene !== "winner") return;

    const showPraxen = window.setTimeout(() => {
      sceneRef.current = "praxenAd";
      setScene("praxenAd");
    }, 5600);

    return () => {
      window.clearTimeout(showPraxen);
    };
  }, [scene]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        if (sceneRef.current === "playing") releaseAllInputs();
        return;
      }
      if (sceneRef.current === "instructions") {
        event.preventDefault();
        if (!event.repeat) returnToTitle();
        return;
      }
      if (sceneRef.current === "title" && event.code === "KeyH") {
        event.preventDefault();
        if (!event.repeat) showInstructions();
        return;
      }
      if (sceneRef.current === "quiz") {
        if (quizAnswerIndexRef.current !== null) {
          event.preventDefault();
          if (!event.repeat) advanceQuizFeedback();
          return;
        }
        if (event.code === "KeyM") {
          event.preventDefault();
          if (!event.repeat) setMuted((value) => !value);
          return;
        }
        if (event.repeat) return;
        const questions = buildLevelQuiz(LEVELS, levelIndexRef.current);
        const question = questions[quizQuestionIndexRef.current];
        let answerIndex: number | null = null;
        const numberKey = /^(?:Digit|Numpad)([1-3])$/.exec(event.code);
        if (numberKey) answerIndex = Number(numberKey[1]) - 1;
        if (
          question?.mode === "true-false" &&
          (event.code === "KeyT" || event.code === "KeyY")
        ) {
          answerIndex = 0;
        }
        if (
          question?.mode === "true-false" &&
          (event.code === "KeyF" || event.code === "KeyN")
        ) {
          answerIndex = 1;
        }
        if (answerIndex !== null) {
          event.preventDefault();
          answerQuiz(answerIndex);
        }
        return;
      }
      const directLevel = /^(?:Digit|Numpad)([0-9])$/.exec(event.code);
      if (directLevel || event.code === "KeyG") {
        const selectedNumber = directLevel ? Number(directLevel[1]) : 11;
        const targetLevel = selectedNumber === 0 ? 9 : selectedNumber - 1;
        if (targetLevel < LEVELS.length) {
          event.preventDefault();
          if (!event.repeat) startLevel(targetLevel);
          return;
        }
      }
      if (isGameplayControlCode(event.code)) {
        event.preventDefault();
      }
      if (
        sceneRef.current === "splash" &&
        (event.code === "Space" || event.code === "Enter")
      ) {
        event.preventDefault();
        if (!event.repeat) enterTitle();
        return;
      }
      if (
        sceneRef.current === "title" &&
        (event.code === "Space" || event.code === "Enter")
      ) {
        event.preventDefault();
        startCampaign();
        return;
      }
      if (
        sceneRef.current === "complete"
      ) {
        if (event.code === "Space" || event.code === "Enter") {
          event.preventDefault();
          if (!event.repeat) advanceCampaign();
          return;
        }
        if (event.code === "KeyR") {
          event.preventDefault();
          if (!event.repeat) replayCurrentLevel();
          return;
        }
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
      if (event.code === "KeyM") setMuted((value) => !value);
      if (sceneRef.current !== "playing") return;
      pressControlKey(controlStateRef.current, event.code);
      syncInputFromSources();
    };
    const keyUp = (event: KeyboardEvent) => {
      releaseControlKey(controlStateRef.current, event.code);
      syncInputFromSources();
    };
    const releaseIfHidden = () => {
      if (document.visibilityState !== "visible") releaseAllInputs();
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", releaseAllInputs);
    window.addEventListener("pagehide", releaseAllInputs);
    document.addEventListener("visibilitychange", releaseIfHidden);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", releaseAllInputs);
      window.removeEventListener("pagehide", releaseAllInputs);
      document.removeEventListener("visibilitychange", releaseIfHidden);
      releaseAllInputs();
    };
  }, [
    advanceCampaign,
    advanceQuizFeedback,
    answerQuiz,
    enterTitle,
    releaseAllInputs,
    replayCurrentLevel,
    returnToTitle,
    showInstructions,
    syncInputFromSources,
    startCampaign,
    startLevel,
  ]);

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
      const activeLayout = LEVEL_LAYOUTS[levelIndexRef.current];
      const activeWorldWidth = activeLayout.worldWidth ?? WORLD_W;
      const activeExitFieldX = activeLayout.exitFieldX ?? EXIT_FIELD_X;
      const activeExitFieldLeft = activeExitFieldX - 62;
      const bonusCrate = bonusCrateRef.current;
      let activePlatforms = activeLayout.platforms.map((platform) =>
        platformAtTime(platform, player.runClock),
      );
      if (sceneRef.current === "playing") {
        const input = inputRef.current;
        const previousPlatforms = activePlatforms;
        const nextPlatformTime = player.runClock + dt;
        const nextPlatforms = activeLayout.platforms.map((platform) =>
          platformAtTime(platform, nextPlatformTime),
        );
        const standingPlatformIndex = standingPlatformRef.current;
        if (
          player.grounded &&
          standingPlatformIndex !== null &&
          activePlatforms[standingPlatformIndex] &&
          nextPlatforms[standingPlatformIndex]
        ) {
          player.x +=
            nextPlatforms[standingPlatformIndex].x -
            activePlatforms[standingPlatformIndex].x;
          player.y +=
            nextPlatforms[standingPlatformIndex].y -
            activePlatforms[standingPlatformIndex].y;
        }
        activePlatforms = nextPlatforms;
        const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (
          factVisibleRef.current &&
          !factDismissingRef.current &&
          shouldFastDismissFactCallout(
            now - factShownAtRef.current,
            input,
          )
        ) {
          dismissFactCalloutForMovement();
        }
        player.vx += (axis * MOVE_SPEED - player.vx) * Math.min(1, dt * 10);
        // Preserve running momentum in the air. This is especially important for
        // touch jumps, where the second tap naturally ends before Praxi lands.
        if (axis === 0 && player.grounded) {
          player.vx *= Math.pow(0.0008, dt);
        }
        if (axis !== 0) player.facing = axis > 0 ? 1 : -1;

        if (input.jump && !jumpLatchRef.current && player.grounded) {
          player.vy = -JUMP_SPEED;
          player.grounded = false;
          jumpLatchRef.current = true;
          if (mobileJumpSfxRef.current) {
            mobileJumpSfxRef.current = false;
          } else {
            playSfx("jump");
          }
        }
        if (!input.jump) jumpLatchRef.current = false;
        if (!input.jump && player.vy < -260) player.vy *= Math.pow(0.018, dt);

        const previousY = player.y;
        player.vy += GRAVITY * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.x = Math.max(
          0,
          Math.min(activeWorldWidth - player.w, player.x),
        );
        player.grounded = false;
        standingPlatformRef.current = null;

        for (const [platformIndex, platform] of activePlatforms.entries()) {
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
            standingPlatformRef.current = platformIndex;
          }
        }

        const standingPlatform =
          standingPlatformRef.current === null
            ? null
            : activePlatforms[standingPlatformRef.current];
        if (player.grounded && !standingPlatform?.motion) {
          safePositionRef.current = { x: player.x, y: player.y };
        }

        if (player.y > VIEW_H + 180) {
          player.x = safePositionRef.current.x;
          player.y = safePositionRef.current.y - 24;
          player.vy = -320;
          player.invulnerable = PLAYER_INVULNERABILITY_SECONDS;
          healthRef.current = Math.max(0, healthRef.current - 1);
          setHealth(healthRef.current);
          triggerDamageEffect(player);
          playSfx("playerHit");
          if (healthRef.current <= 0) {
            triggerGameOver();
          }
        }

        player.invulnerable = Math.max(0, player.invulnerable - dt);
        player.runClock = nextPlatformTime;

        const activeTraps = activeLayout.energyTraps ?? [];
        const firingTraps = activeTraps.map((trap) => {
          const screenX = trap.x - cameraRef.current;
          const isAudible = screenX > -120 && screenX < VIEW_W + 120;
          return (
            isAudible &&
            energyTrapState(trap, player.runClock).mode === "firing"
          );
        });
        firingTraps.forEach((isFiring, trapIndex) => {
          if (isFiring && !laserFiringRef.current[trapIndex]) {
            playSfx("laser");
          }
        });
        laserFiringRef.current = firingTraps;

        for (const trap of activeTraps) {
          if (energyTrapState(trap, player.runClock).mode !== "firing") {
            continue;
          }
          const overlapsBeam =
            player.x < trap.x + trap.w &&
            player.x + player.w > trap.x &&
            player.y < trap.y &&
            player.y + player.h > 110;
          if (overlapsBeam && player.invulnerable <= 0) {
            healthRef.current = Math.max(0, healthRef.current - 1);
            setHealth(healthRef.current);
            player.invulnerable = PLAYER_INVULNERABILITY_SECONDS;
            player.grounded = false;
            standingPlatformRef.current = null;
            triggerDamageEffect(player);
            player.vx =
              player.x + player.w / 2 < trap.x + trap.w / 2 ? -390 : 390;
            player.vy = -460;
            playSfx("playerHit");
            if (healthRef.current <= 0) {
              triggerGameOver();
              break;
            }
          }
        }

        const tailSpeed = Math.abs(player.vx);
        const tailIsMoving = tailSpeed > 55;
        const tailEmissionRate = tailIsMoving
          ? 11 + Math.min(9, tailSpeed / 48)
          : 7;
        tailDustClockRef.current += dt * tailEmissionRate;
        while (tailDustClockRef.current >= 1) {
          tailDustClockRef.current -= 1;
          const serial = tailDustSerialRef.current++;
          const shimmer = Math.sin(serial * 12.9898) * 0.5 + 0.5;
          const lift = Math.sin(serial * 5.398) * 0.5 + 0.5;
          const trailDirection = player.vx === 0 ? -player.facing : -Math.sign(player.vx);
          const tailX =
            player.x +
            player.w / 2 -
            player.facing * (48 + shimmer * 11);
          const tailY =
            player.y +
            player.h -
            68 +
            Math.sin(player.runClock * 12 + serial) * 8;
          const maxLife = tailIsMoving
            ? 0.48 + shimmer * 0.34
            : 0.45 + shimmer * 0.25;
          tailDustRef.current.push({
            x: tailX + trailDirection * shimmer * 8,
            y: tailY + (lift - 0.5) * 20,
            vx: tailIsMoving
              ? player.vx * (0.06 + shimmer * 0.12) + trailDirection * 18
              : trailDirection * (8 + shimmer * 12),
            vy: -8 - lift * 30,
            life: maxLife,
            maxLife,
            size: 3.5 + shimmer * 5.2,
            rotation: shimmer * Math.PI,
            spin: (shimmer - 0.5) * 5,
            kind:
              serial % 5 === 0
                ? "cross"
                : serial % 3 === 0
                  ? "diamond"
                  : "pixel",
            front: !tailIsMoving || serial % 3 === 0,
          });
        }
        tailDustRef.current = tailDustRef.current
          .map((mote) => ({
            ...mote,
            x: mote.x + mote.vx * dt,
            y: mote.y + mote.vy * dt,
            vy: mote.vy - 4 * dt,
            life: mote.life - dt,
            rotation: mote.rotation + mote.spin * dt,
          }))
          .filter((mote) => mote.life > 0)
          .slice(-90);

        if (bonusCrate && !bonusCrate.collected) {
          bonusCrate.pulse += dt;
          const overlapsBonus =
            player.x < bonusCrate.x + bonusCrate.w &&
            player.x + player.w > bonusCrate.x &&
            player.y < bonusCrate.y + bonusCrate.h &&
            player.y + player.h > bonusCrate.y;
          if (overlapsBonus) {
            bonusCrate.collected = true;
            healthRef.current = Math.min(
              BONUS_INTEGRITY_CAP,
              healthRef.current + 1,
            );
            setHealth(healthRef.current);
            bonusBurstRef.current = {
              x: bonusCrate.x + bonusCrate.w / 2,
              y: bonusCrate.y - 12,
              time: 1.5,
            };
            playSfx("powerUp");
            for (let i = 0; i < 22; i++) {
              const a = (Math.PI * 2 * i) / 22;
              particlesRef.current.push({
                x: bonusCrate.x + bonusCrate.w / 2,
                y: bonusCrate.y + bonusCrate.h / 2,
                vx: Math.cos(a) * (70 + (i % 5) * 20),
                vy: Math.sin(a) * (70 + (i % 4) * 22),
                life: 0.7 + (i % 3) * 0.13,
                color: i % 2 ? "#72f5ff" : "#ffac32",
              });
            }
          }
        }

        for (const enemy of enemies) {
          if (sceneRef.current !== "playing") break;

          if (enemy.ridingPlatformIndex !== undefined) {
            const previousPlatform =
              previousPlatforms[enemy.ridingPlatformIndex];
            const nextPlatform = activePlatforms[enemy.ridingPlatformIndex];
            if (previousPlatform && nextPlatform) {
              const platformDx = nextPlatform.x - previousPlatform.x;
              const platformDy = nextPlatform.y - previousPlatform.y;
              enemy.x += platformDx;
              enemy.y += platformDy;
              enemy.minX += platformDx;
              enemy.maxX += platformDx;
            }
          }
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
              showFactCallout();
              playSfx("enemyHit");
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
              player.invulnerable = PLAYER_INVULNERABILITY_SECONDS;
              triggerDamageEffect(player);
              player.vx = player.x < enemy.x ? -420 : 420;
              player.vy = -410;
              playSfx("playerHit");
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
          player.x + player.w > activeExitFieldLeft
        ) {
          player.x = activeExitFieldLeft - player.w;
          player.vx = Math.min(0, player.vx);
        }

        captureTimeRef.current = Math.max(0, captureTimeRef.current - dt);
        if (bonusBurstRef.current) {
          bonusBurstRef.current.time -= dt;
          if (bonusBurstRef.current.time <= 0) {
            bonusBurstRef.current = null;
          }
        }
        if (damageBurstRef.current) {
          damageBurstRef.current.time -= dt;
          if (damageBurstRef.current.time <= 0) {
            damageBurstRef.current = null;
          }
        }
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
          Math.min(activeWorldWidth - VIEW_W, player.x - VIEW_W * 0.34),
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
          factRef.current.style.left = `${(Math.max(260, Math.min(1020, playerScreenX)) / VIEW_W) * 100}%`;
          factRef.current.style.top = `${(factY / VIEW_H) * 100}%`;
        }

        if (
          sceneRef.current === "playing" &&
          player.x > activeExitFieldX + 68 &&
          enemies.every((enemy) => !enemy.active) &&
          fieldUnlockProgress >= 1
        ) {
          sceneRef.current = "quiz";
          setScene("quiz");
        }
      }

      drawBackground(
        ctx,
        cameraRef.current,
        artRef.current.backgrounds?.[levelIndexRef.current],
      );
      for (const platform of activePlatforms) {
        drawPlatform(ctx, platform, cameraRef.current);
      }
      for (const trap of activeLayout.energyTraps ?? []) {
        drawEnergyTrap(
          ctx,
          trap,
          cameraRef.current,
          player.runClock,
        );
      }
      if (bonusCrate) {
        drawBonusCrate(
          ctx,
          bonusCrate,
          cameraRef.current,
          artRef.current.bonusCrate,
        );
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
        activeExitFieldX,
      );
      for (const enemy of enemies) {
        drawPromptInjection(
          ctx,
          enemy,
          cameraRef.current,
          artRef.current.enemies?.[
            enemy.artIndex ?? levelIndexRef.current
          ],
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
      drawTailDust(ctx, tailDustRef.current, cameraRef.current, false);
      if (damageBurstRef.current) {
        drawDamageBurst(ctx, damageBurstRef.current, cameraRef.current);
      }
      drawPraxi(
        ctx,
        player,
        cameraRef.current,
        artRef.current.runFrames,
        artRef.current.ready,
        artRef.current.jump,
      );
      drawTailDust(ctx, tailDustRef.current, cameraRef.current, true);
      if (bonusBurstRef.current) {
        drawBonusBurst(ctx, bonusBurstRef.current, cameraRef.current);
      }

      for (const particle of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, particle.life);
        circle(
          ctx,
          particle.x - cameraRef.current,
          particle.y,
          particle.size ?? 3,
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
  }, [
    dismissFactCalloutForMovement,
    playSfx,
    showFactCallout,
    triggerDamageEffect,
    triggerGameOver,
  ]);

  const pressMobileJump = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (jumpPointerRef.current !== null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      jumpPointerRef.current = event.pointerId;
      if (playerRef.current.grounded && !jumpLatchRef.current) {
        // iOS requires a newly created media voice to start inside the touch
        // gesture. The game loop still owns the actual jump physics.
        mobileJumpSfxRef.current = true;
        playSfx("jump");
      }
      setTouchJump(controlStateRef.current, true);
      syncInputFromSources();
    },
    [playSfx, syncInputFromSources],
  );

  const releaseMobileJump = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (jumpPointerRef.current !== event.pointerId) return;
      jumpPointerRef.current = null;
      setTouchJump(controlStateRef.current, false);
      syncInputFromSources();
      if (playerRef.current.grounded && !jumpLatchRef.current) {
        mobileJumpSfxRef.current = false;
      }
    },
    [syncInputFromSources],
  );

  const pressMobileDirection = useCallback(
    (
      event: React.PointerEvent<HTMLButtonElement>,
      direction: "left" | "right",
    ) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setTouchDirection(controlStateRef.current, event.pointerId, direction);
      syncInputFromSources();
    },
    [syncInputFromSources],
  );

  const releaseMobileDirection = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      releaseTouchDirection(controlStateRef.current, event.pointerId);
      syncInputFromSources();
    },
    [syncInputFromSources],
  );

  const currentLevel = LEVELS[levelIndex];
  const factLesson = currentLevel.lessons[factLessonIndex];
  const quizQuestions = buildLevelQuiz(LEVELS, levelIndex);
  const quizQuestion = quizQuestions[quizQuestionIndex];
  const isFinalLevel = levelIndex === LEVELS.length - 1;
  const encounterCount = currentLevel.lessons.length;

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
              <button
                type="button"
                className="sponsor-start"
                onClick={enterTitle}
                data-testid="sponsor-start"
              >
                <span className="desktop-start-copy">
                  PRESS SPACE / CLICK TO START
                </span>
                <span className="touch-start-copy">TAP TO START</span>
              </button>
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
            <div className="title-praxi-stage" aria-hidden="true">
              <img
                className="title-praxi"
                src="./assets/praxi-idle-v6.png"
                alt=""
              />
              <div className="title-tail-generator">
                {Array.from({ length: 14 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            </div>
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
                <span className="desktop-start-copy">PRESS SPACE TO START</span>
                <span className="touch-start-copy">TAP TO START</span>
              </button>
              <button
                type="button"
                className="arcade-instructions"
                onClick={showInstructions}
                data-testid="show-instructions"
                aria-label="How to play Promptfall"
              >
                <span className="arcade-instructions-key">H</span>
                <span>HOW TO PLAY</span>
              </button>
              <div className="arcade-controls">
                <span className="desktop-control-copy">
                  ← → / A D&nbsp;&nbsp;MOVE&nbsp;&nbsp;•&nbsp;&nbsp;SPACE&nbsp;&nbsp;JUMP
                </span>
                <span className="touch-control-copy">
                  ARROWS MOVE&nbsp;&nbsp;•&nbsp;&nbsp;JUMP BUTTON JUMPS
                </span>
                <span className="arcade-level-select">
                  1–9 / 0 / G&nbsp;&nbsp;DIRECT LEVEL SELECT
                </span>
              </div>
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

        {scene === "instructions" && (
          <div
            className="screen screen--instructions"
            data-testid="instructions-screen"
            aria-label="How to play Promptfall"
          >
            <div className="title-background" aria-hidden="true" />
            <div className="title-grid" aria-hidden="true" />
            <div className="instructions-scanlines" aria-hidden="true" />
            <header className="instructions-header">
              <span>PLAYER INTEL // OWASP TRAINING MODE</span>
              <h1>MISSION BRIEFING</h1>
              <strong>HOW TO PLAY</strong>
            </header>

            <div className="instructions-praxi" aria-hidden="true">
              <div className="instructions-praxi-glow" />
              <img src="./assets/praxi-idle-v6.png" alt="" />
              <div className="title-tail-generator instructions-tail-generator">
                {Array.from({ length: 14 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            </div>

            <div className="instructions-grid">
              <section className="instruction-panel instruction-panel--hero">
                <span className="instruction-number">01</span>
                <div>
                  <h2>MEET PRAXI</h2>
                  <p>
                    Praxi is your tiny cyber hero. Help him defeat the
                    <strong> OWASP Top 10 for LLM vulnerabilities.</strong>
                  </p>
                </div>
              </section>

              <section className="instruction-panel">
                <span className="instruction-number">02</span>
                <div>
                  <h2>MOVE + JUMP</h2>
                  <p className="desktop-instruction-copy">
                    <span className="instruction-control-line">
                      <strong>MOVE</strong> <kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd>
                    </span>
                    <span className="instruction-control-line">
                      <strong>JUMP</strong> <kbd>SPACE</kbd> / <kbd>W</kbd> / <kbd>↑</kbd>
                    </span>
                  </p>
                  <p className="touch-instruction-copy">
                    <span className="instruction-control-line">
                      <strong>MOVE</strong> Use the left and right arrow buttons.
                    </span>
                    <span className="instruction-control-line">
                      <strong>JUMP</strong> Hold ↑ for a higher jump.
                    </span>
                  </p>
                </div>
              </section>

              <section className="instruction-panel">
                <span className="instruction-number">03</span>
                <div>
                  <h2>CONTAIN THREATS</h2>
                  <p>
                    Jump on every enemy. Each stomp reveals a quick
                    <strong> definition, example, or defense.</strong>
                  </p>
                </div>
              </section>

              <section className="instruction-panel">
                <span className="instruction-number">04</span>
                <div>
                  <h2>BREAK THE BARRIER</h2>
                  <p>
                    Clear every encounter, then cross the retracted force
                    field to complete the level.
                  </p>
                </div>
              </section>

              <section className="instruction-panel instruction-panel--learning">
                <span className="instruction-number">05</span>
                <div>
                  <h2>LEARNING TIPS</h2>
                  <p>
                    <span className="learning-tip-line">
                      <strong>1.</strong> Pause to read the intel after each capture.
                    </span>
                    <span className="learning-tip-line">
                      <strong>2.</strong> Listen for insights in each level&apos;s lyrics.
                    </span>
                  </p>
                </div>
              </section>

              <section className="instruction-panel instruction-panel--codes">
                <span className="instruction-number">★</span>
                <div>
                  <h2>TRAINING CODES // SKIP AHEAD</h2>
                  <p>
                    <kbd>1–9</kbd> LEVELS 1–9
                    <b> • </b>
                    <kbd>0</kbd> LEVEL 10
                    <b> • </b>
                    <kbd>G</kbd> THE GAUNTLET
                  </p>
                </div>
              </section>
            </div>

            <button
              type="button"
              className="instructions-return"
              onClick={returnToTitle}
              data-testid="return-to-title"
            >
              <span className="desktop-start-copy">PRESS ANY KEY TO RETURN</span>
              <span className="touch-start-copy">TAP TO RETURN</span>
            </button>
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
              <div className="hud-level-meta">
                <strong>
                  {currentLevel.riskCode}: {currentLevel.objectiveName}
                </strong>
                <small>
                  SOUND TRACK: <span>{currentLevel.soundtrack}</span>
                </small>
              </div>
              <div className="hud-status">
                <div className="health" aria-label={`${health} integrity remaining`}>
                  <small>INTEGRITY</small>
                  <span>{"◆".repeat(Math.max(0, health))}</span>
                  <span className="health-empty">
                    {"◆".repeat(Math.max(0, STARTING_INTEGRITY - health))}
                  </span>
                </div>
                <div className="risk-count">
                  <small>ENCOUNTERS CLEARED</small>
                  <strong>
                    {String(captured).padStart(2, "0")} /{" "}
                    {String(encounterCount).padStart(2, "0")}
                  </strong>
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
              className={`fact-callout ${callout ? "is-visible" : ""}${calloutDismissing ? " is-dismissing" : ""}`}
              role="status"
              aria-live="polite"
            >
              <div className="fact-copy">
                <strong>{formatLessonKind(factLesson.kind)}:</strong>
                <p>{factLesson.text}</p>
              </div>
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

        {scene === "quiz" && quizQuestion && (
          <div
            className="quiz-screen"
            data-testid="level-quiz"
            onPointerDown={() => {
              if (quizAnswerIndexRef.current !== null) {
                advanceQuizFeedback();
              }
            }}
          >
            <div className="quiz-grid" aria-hidden="true" />
            <div className="quiz-debrief">
              <header className="quiz-header">
                <div>
                  <small>
                    MISSION DEBRIEF // {currentLevel.riskCode}
                  </small>
                  <h2>KNOWLEDGE CHECK</h2>
                </div>
                <div className="quiz-score">
                  <small>SCORE</small>
                  <strong>
                    {String(quizScore).padStart(2, "0")} / 03
                  </strong>
                </div>
              </header>

              <div className="quiz-progress" aria-label={`Question ${quizQuestionIndex + 1} of 3`}>
                {quizQuestions.map((_question, index) => (
                  <span
                    key={index}
                    className={
                      index < quizQuestionIndex
                        ? "is-complete"
                        : index === quizQuestionIndex
                          ? "is-active"
                          : ""
                    }
                  />
                ))}
              </div>

              {quizAnswerIndex !== null && (
                <div
                  key={`${levelIndex}-${quizQuestionIndex}-${quizAnswerIndex}`}
                  className={`quiz-feedback-burst${quizAnswerIndex === quizQuestion.correctIndex ? " is-correct" : " is-wrong"}`}
                  role="status"
                  aria-live="assertive"
                >
                  <span>
                    {quizAnswerIndex === quizQuestion.correctIndex
                      ? "REINFORCEMENT"
                      : "CORRECTION"}
                  </span>
                  <strong>
                    {quizAnswerIndex === quizQuestion.correctIndex
                      ? "CORRECT!"
                      : "NOT QUITE"}
                  </strong>
                  <p>
                    {quizAnswerIndex === quizQuestion.correctIndex ? (
                      quizQuestion.explanation
                    ) : (
                      <>
                        RIGHT ANSWER:{" "}
                        <b>
                          {quizQuestion.options[quizQuestion.correctIndex]}
                        </b>
                      </>
                    )}
                  </p>
                </div>
              )}

              <section
                key={`${levelIndex}-${quizQuestionIndex}`}
                className={`quiz-question${quizAnswerIndex !== null ? " is-answered" : ""}`}
                aria-live="polite"
              >
                <div className="quiz-mode">
                  QUESTION {quizQuestionIndex + 1}
                  {" // "}
                  {quizQuestion.mode === "true-false"
                    ? "TRUE OR FALSE"
                    : "MULTIPLE CHOICE"}
                </div>
                <h3>{quizQuestion.prompt}</h3>
                <div
                  className={`quiz-answers${quizQuestion.options.length === 2 ? " quiz-answers--binary" : ""}`}
                >
                  {quizQuestion.options.map((option, index) => {
                    const answered = quizAnswerIndex !== null;
                    const correct = index === quizQuestion.correctIndex;
                    const selected = index === quizAnswerIndex;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`quiz-answer${answered && correct ? " is-correct" : ""}${answered && selected && !correct ? " is-wrong" : ""}`}
                        onClick={() => answerQuiz(index)}
                        disabled={answered}
                      >
                        <kbd>{index + 1}</kbd>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                {quizAnswerIndex === null && (
                  <div className="quiz-answer-hint">
                    PRESS 1–3 OR TAP YOUR ANSWER
                    {quizQuestion.mode === "true-false"
                      ? " // T/F ALSO WORK"
                      : ""}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {scene === "complete" && (
          <div className="arcade-complete-screen" data-testid="mission-complete">
            <div className="level-complete-burst">
              <span>LEVEL</span>
              <strong>COMPLETE!</strong>
              <em className="level-complete-score">
                KNOWLEDGE CHECK {String(quizScore).padStart(2, "0")} / 03
              </em>
              <div className="level-complete-actions">
                <button
                  type="button"
                  className="arcade-next"
                  onClick={advanceCampaign}
                >
                  <span className="desktop-start-copy">
                    PRESS SPACE: NEXT LEVEL
                  </span>
                  <span className="touch-start-copy">NEXT LEVEL</span>
                </button>
                <button
                  type="button"
                  className="arcade-next arcade-replay"
                  onClick={replayCurrentLevel}
                >
                  <span className="desktop-start-copy">PRESS R: REPLAY LEVEL</span>
                  <span className="touch-start-copy">REPLAY LEVEL</span>
                </button>
              </div>
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

        {scene === "winner" && (
          <div className="winner-screen" data-testid="campaign-winner">
            <div className="winner-fireworks" aria-hidden="true">
              {Array.from({ length: 14 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    left: `${7 + ((index * 29) % 87)}%`,
                    top: `${8 + ((index * 37) % 66)}%`,
                    animationDelay: `${0.25 + (index % 7) * 0.42}s`,
                    filter: `hue-rotate(${index * 41}deg)`,
                  }}
                />
              ))}
            </div>
            <div className="winner-burst">
              <span>ALL TEN RISKS CONTAINED</span>
              <strong>
                YOUR AGENT
                <br />
                IS SECURE!
              </strong>
              <small>MISSION ACCOMPLISHED</small>
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

        {scene !== "playing" && scene !== "complete" && (
          <button
            className="mute-button mute-button--overlay"
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Enable sound" : "Mute sound"}
          >
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
        )}

        <div className="scanlines" aria-hidden="true" />
      </section>
      {scene === "playing" && (
        <div
          className="mobile-gamepad"
          role="group"
          aria-label="Mobile game controls"
        >
          <div className="mobile-direction-rocker">
            <button
              type="button"
              className="mobile-control-button mobile-control-button--left"
              aria-label="Move left"
              onPointerDown={(event) => pressMobileDirection(event, "left")}
              onPointerUp={releaseMobileDirection}
              onPointerCancel={releaseMobileDirection}
              onLostPointerCapture={releaseMobileDirection}
            >
              <span
                className="mobile-arrow-face"
                aria-hidden="true"
              >
                <span className="mobile-arrow mobile-arrow--left" />
              </span>
            </button>
            <button
              type="button"
              className="mobile-control-button mobile-control-button--right"
              aria-label="Move right"
              onPointerDown={(event) => pressMobileDirection(event, "right")}
              onPointerUp={releaseMobileDirection}
              onPointerCancel={releaseMobileDirection}
              onLostPointerCapture={releaseMobileDirection}
            >
              <span
                className="mobile-arrow-face"
                aria-hidden="true"
              >
                <span className="mobile-arrow mobile-arrow--right" />
              </span>
            </button>
          </div>
          <button
            type="button"
            className="mobile-control-button mobile-control-button--jump"
            aria-label="Jump"
            onPointerDown={pressMobileJump}
            onPointerUp={releaseMobileJump}
            onPointerCancel={releaseMobileJump}
            onLostPointerCapture={releaseMobileJump}
          >
            <span className="mobile-arrow-face" aria-hidden="true">
              <span className="mobile-arrow mobile-arrow--up" />
            </span>
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {scene === "levelIntro"
          ? `Level ${currentLevel.number}: ${currentLevel.name}. Get ready.`
          : scene === "playing"
            ? `Level ${currentLevel.number} active. ${captured} of ${encounterCount} encounters cleared. ${health} integrity remaining.`
          : scene === "quiz"
            ? `Level ${currentLevel.number} knowledge check. Question ${quizQuestionIndex + 1} of three. ${quizQuestion?.prompt ?? ""}`
          : scene === "complete"
            ? isFinalLevel
              ? "Level complete. Return to the title."
              : `Level complete. Knowledge check score ${quizScore} of three. Continue to the next level, or replay this level.`
          : scene === "gameOver"
            ? "Game over."
          : scene === "winner"
            ? "All ten OWASP risks contained. Your agent is secure. Mission accomplished."
          : scene === "praxenAd"
            ? "Want to scan your own agents for the OWASP Top 10? Get Praxen, free and open source, or restart the game."
            : ""}
      </p>
    </main>
  );
}

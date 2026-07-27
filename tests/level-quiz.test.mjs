import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  QUIZ_FEEDBACK_MS,
  QUIZ_QUESTION_COUNT,
  buildLevelQuiz,
} from "../app/level-quiz.js";

const LEVEL_FIXTURES = Array.from({ length: 10 }, (_, index) => ({
  objectiveName: `Risk ${index + 1}`,
  lessons: [
    { kind: "DEFINITION", text: `Definition ${index + 1}` },
    { kind: "EXAMPLE 1", text: `Example ${index + 1}` },
    { kind: "DEFENSE 1", text: `Defense ${index + 1}` },
  ],
}));

const GAUNTLET_FIXTURE = {
  objectiveName: "Gauntlet",
  lessons: Array.from({ length: 10 }, (_, index) => ({
    kind: "KEY INSIGHT",
    riskCode: `LLM${String(index + 1).padStart(2, "0")}`,
    entryName: `RISK ${index + 1}`,
    text: `Insight ${index + 1}`,
  })),
};

test("builds three answerable questions for every level", () => {
  const levels = [...LEVEL_FIXTURES, GAUNTLET_FIXTURE];

  levels.forEach((_level, levelIndex) => {
    const questions = buildLevelQuiz(levels, levelIndex);
    assert.equal(questions.length, QUIZ_QUESTION_COUNT);
    questions.forEach((question) => {
      assert.ok(question.prompt.length > 10);
      assert.ok(question.options.length === 2 || question.options.length === 3);
      assert.ok(question.correctIndex >= 0);
      assert.ok(question.correctIndex < question.options.length);
      assert.ok(question.explanation.length > 5);
    });
  });
});

test("uses exact level intel for examples and defenses", () => {
  const levels = [...LEVEL_FIXTURES, GAUNTLET_FIXTURE];
  const questions = buildLevelQuiz(levels, 4);

  assert.ok(questions[1].options.includes("Example 5"));
  assert.equal(
    questions[1].options[questions[1].correctIndex],
    "Example 5",
  );
  assert.ok(questions[2].options.includes("Defense 5"));
  assert.equal(
    questions[2].options[questions[2].correctIndex],
    "Defense 5",
  );
});

test("mixes true and false definition checks across campaign levels", () => {
  const levels = [...LEVEL_FIXTURES, GAUNTLET_FIXTURE];
  assert.equal(buildLevelQuiz(levels, 0)[0].correctIndex, 0);
  assert.equal(buildLevelQuiz(levels, 1)[0].correctIndex, 1);
});

test("keeps feedback fast enough for an arcade debrief", () => {
  assert.equal(QUIZ_FEEDBACK_MS, 1_650);
});

test("wires the quiz before level-complete and winner scenes", async () => {
  const source = await readFile(
    new URL("../app/Game.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /sceneRef\.current = "quiz"/);
  assert.match(source, /scene === "quiz"/);
  assert.match(source, /answerQuiz/);
  assert.match(source, /QUIZ_FEEDBACK_MS/);
});

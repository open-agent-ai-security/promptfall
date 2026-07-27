import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  QUIZ_FEEDBACK_MS,
  QUIZ_QUESTION_COUNT,
  buildLevelQuiz,
} from "../app/level-quiz.js";

const LEVEL_FIXTURES = [
  ...Array.from({ length: 10 }, (_, index) => ({
    riskCode: `LLM${String(index + 1).padStart(2, "0")}`,
  })),
  { riskCode: "CAPSTONE" },
];

test("provides three answerable conceptual questions for every stage", () => {
  LEVEL_FIXTURES.forEach((_level, levelIndex) => {
    const questions = buildLevelQuiz(LEVEL_FIXTURES, levelIndex);
    assert.equal(questions.length, QUIZ_QUESTION_COUNT);
    questions.forEach((question) => {
      assert.ok(question.prompt.length > 20);
      assert.ok(question.options.length === 2 || question.options.length === 3);
      assert.ok(question.correctIndex >= 0);
      assert.ok(question.correctIndex < question.options.length);
      assert.ok(question.explanation.length > 10);
    });
  });
});

test("avoids lesson-recall and stage-label language", () => {
  const forbidden = /\b(?:intel|info blocks?|thought bubbles?|level|gauntlet)\b/i;

  LEVEL_FIXTURES.forEach((_level, levelIndex) => {
    buildLevelQuiz(LEVEL_FIXTURES, levelIndex).forEach((question) => {
      [question.prompt, ...question.options, question.explanation].forEach(
        (text) => assert.doesNotMatch(text, forbidden),
      );
    });
  });
});

test("keeps answer choices concise enough for an arcade screen", () => {
  LEVEL_FIXTURES.forEach((_level, levelIndex) => {
    buildLevelQuiz(LEVEL_FIXTURES, levelIndex).forEach((question) => {
      question.options.forEach((option) => {
        assert.ok(
          option.length <= 72,
          `Answer is too long (${option.length} characters): ${option}`,
        );
      });
    });
  });
});

test("includes both true-false and multiple-choice questions", () => {
  const modes = new Set(
    LEVEL_FIXTURES.flatMap((_level, levelIndex) =>
      buildLevelQuiz(LEVEL_FIXTURES, levelIndex).map(
        (question) => question.mode,
      ),
    ),
  );

  assert.deepEqual(modes, new Set(["true-false", "multiple-choice"]));
});

test("balances true and false checks across the ten vulnerabilities", () => {
  const correctAnswers = LEVEL_FIXTURES.slice(0, 10).map(
    (_level, levelIndex) =>
      buildLevelQuiz(LEVEL_FIXTURES, levelIndex)[0].options[
        buildLevelQuiz(LEVEL_FIXTURES, levelIndex)[0].correctIndex
      ],
  );

  assert.equal(correctAnswers.filter((answer) => answer === "TRUE").length, 5);
  assert.equal(correctAnswers.filter((answer) => answer === "FALSE").length, 5);
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

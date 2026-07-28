import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  QUIZ_FEEDBACK_MS,
  QUIZ_QUESTION_COUNT,
  QUIZ_WRONG_FEEDBACK_MS,
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

test("holds reinforcement and correction for the same five seconds", () => {
  assert.equal(QUIZ_FEEDBACK_MS, 5_000);
  assert.equal(QUIZ_WRONG_FEEDBACK_MS, 5_000);
  assert.equal(QUIZ_WRONG_FEEDBACK_MS, QUIZ_FEEDBACK_MS);
});

test("wires the quiz before level-complete and winner scenes", async () => {
  const source = await readFile(
    new URL("../app/Game.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /sceneRef\.current = "quiz"/);
  assert.match(source, /scene === "quiz"/);
  assert.match(source, /answerQuiz/);
  assert.match(source, /advanceQuizFeedback/);
  assert.match(source, /QUIZ_FEEDBACK_MS/);
  assert.match(
    source,
    /window\.setTimeout\(\s*advanceQuizFeedback,\s*QUIZ_FEEDBACK_MS/,
  );
  assert.match(source, /onPointerDown/);
  assert.match(
    source,
    /quizAnswerIndexRef\.current !== null[\s\S]*advanceQuizFeedback/,
  );
});

test("offers keyboard and touch-friendly continue or replay actions", async () => {
  const source = await readFile(
    new URL("../app/Game.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /event\.code === "KeyR"/);
  assert.match(source, /replayCurrentLevel/);
  assert.match(source, /PRESS SPACE: NEXT LEVEL/);
  assert.match(source, /PRESS R: REPLAY LEVEL/);
  assert.match(source, />NEXT LEVEL</);
  assert.match(source, />REPLAY LEVEL</);
});

test("uses a smooth next-level prompt instead of a stepped flash", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /animation: next-button-breathe 2\.2s 1\.9s ease-in-out infinite/,
  );
  assert.match(styles, /@keyframes next-button-breathe/);
});

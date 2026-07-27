export const QUIZ_QUESTION_COUNT = 3;
export const QUIZ_FEEDBACK_MS = 1_650;

const rotateOptions = (correct, distractors, correctIndex) => {
  const options = [...distractors];
  options.splice(correctIndex, 0, correct);
  return { options, correctIndex };
};

const lessonByKind = (level, prefix) =>
  level.lessons.find((lesson) => lesson.kind.startsWith(prefix));

export function buildLevelQuiz(levels, levelIndex) {
  const level = levels[levelIndex];
  if (!level) return [];

  const campaignLevels = levels.slice(0, 10);
  if (levelIndex >= campaignLevels.length) {
    const insightIndexes = [6, 8, 9];
    return insightIndexes.map((lessonIndex, questionIndex) => {
      const insight = level.lessons[lessonIndex];
      const distractorOne =
        level.lessons[(lessonIndex + 3) % level.lessons.length];
      const distractorTwo =
        level.lessons[(lessonIndex + 6) % level.lessons.length];
      const correctIndex = (levelIndex + questionIndex) % 3;
      const { options } = rotateOptions(
        insight.entryName,
        [distractorOne.entryName, distractorTwo.entryName],
        correctIndex,
      );
      return {
        mode: "multiple-choice",
        prompt: `Which risk matches this Gauntlet insight? “${insight.text}”`,
        options,
        correctIndex,
        explanation: `${insight.riskCode}: ${insight.entryName}`,
      };
    });
  }

  const example = lessonByKind(level, "EXAMPLE 1");
  const defense = lessonByKind(level, "DEFENSE 1");
  const otherOne = campaignLevels[(levelIndex + 3) % campaignLevels.length];
  const otherTwo = campaignLevels[(levelIndex + 6) % campaignLevels.length];
  const trueDefinition = levelIndex % 2 === 0;
  const definitionSource = trueDefinition ? level : otherOne;
  const definitionText = lessonByKind(definitionSource, "DEFINITION").text;

  const exampleCorrectIndex = (levelIndex + 1) % 3;
  const exampleOptions = rotateOptions(
    example.text,
    [
      lessonByKind(otherOne, "EXAMPLE 1").text,
      lessonByKind(otherTwo, "EXAMPLE 1").text,
    ],
    exampleCorrectIndex,
  );
  const defenseCorrectIndex = (levelIndex + 2) % 3;
  const defenseOptions = rotateOptions(
    defense.text,
    [
      lessonByKind(otherOne, "DEFENSE 1").text,
      lessonByKind(otherTwo, "DEFENSE 1").text,
    ],
    defenseCorrectIndex,
  );

  return [
    {
      mode: "true-false",
      prompt: `True or false: “${definitionText}” describes ${level.objectiveName}.`,
      options: ["TRUE", "FALSE"],
      correctIndex: trueDefinition ? 0 : 1,
      explanation: trueDefinition
        ? `Correct. That is ${level.objectiveName}.`
        : `That describes ${definitionSource.objectiveName}, not ${level.objectiveName}.`,
    },
    {
      mode: "multiple-choice",
      prompt: `Which scenario appeared in the ${level.objectiveName} intel?`,
      options: exampleOptions.options,
      correctIndex: exampleOptions.correctIndex,
      explanation: "That was one of this level's examples.",
    },
    {
      mode: "multiple-choice",
      prompt: `Which defense was emphasized in the ${level.objectiveName} intel?`,
      options: defenseOptions.options,
      correctIndex: defenseOptions.correctIndex,
      explanation: `That defense directly addresses ${level.objectiveName}.`,
    },
  ];
}

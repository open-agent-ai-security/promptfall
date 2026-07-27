export const QUIZ_QUESTION_COUNT = 3;
export const QUIZ_FEEDBACK_MS = 1_650;

const trueFalse = (prompt, correct, explanation) => ({
  mode: "true-false",
  prompt,
  options: ["TRUE", "FALSE"],
  correctIndex: correct ? 0 : 1,
  explanation,
});

const multipleChoice = (prompt, options, correctIndex, explanation) => ({
  mode: "multiple-choice",
  prompt,
  options,
  correctIndex,
  explanation,
});

const QUESTION_BANK = {
  LLM01: [
    trueFalse(
      "Clearly labeling instructions and data completely prevents Prompt Injection.",
      false,
      "Labels help, but an LLM may still follow untrusted instructions.",
    ),
    multipleChoice(
      "Which situation is Prompt Injection?",
      [
        "A document hides instructions that redirect a summarizer.",
        "A vector database is stolen from a server.",
        "An agent exceeds its monthly token budget.",
      ],
      0,
      "Untrusted document content changed the model's behavior.",
    ),
    multipleChoice(
      "What best limits the damage from Prompt Injection?",
      [
        "Give the model broader access so it can recover.",
        "Limit tool permissions and approve high-impact actions.",
        "Hide all security rules in the system prompt.",
      ],
      1,
      "Least privilege limits what manipulated output can do.",
    ),
  ],
  LLM02: [
    trueFalse(
      "Sensitive Information Disclosure can happen through logs even when the visible reply is safe.",
      true,
      "Logs, traces, tool calls, and other channels can all leak data.",
    ),
    multipleChoice(
      "Which design best protects sensitive information?",
      [
        "Give the model access only to data required for its task.",
        "Place all customer data in one shared context window.",
        "Keep secrets in hidden instructions.",
      ],
      0,
      "Minimizing and separating access reduces exposure.",
    ),
    multipleChoice(
      "Where should a system check for sensitive data?",
      [
        "Only in the final answer shown to the user.",
        "Only in prompts written by administrators.",
        "Across replies, logs, traces, and tool calls.",
      ],
      2,
      "Sensitive data can escape through any system channel.",
    ),
  ],
  LLM03: [
    trueFalse(
      "A read-only database assistant should also have delete access in case it needs it later.",
      false,
      "Unused power creates unnecessary risk.",
    ),
    multipleChoice(
      "Which change most directly reduces Excessive Agency?",
      [
        "Add a longer system prompt.",
        "Give the agent only the tools its task requires.",
        "Let the agent approve its own high-impact actions.",
      ],
      1,
      "An agent should have the minimum power needed for its task.",
    ),
    multipleChoice(
      "How should a high-impact action be authorized?",
      [
        "Use the current user's permissions and require approval.",
        "Trust the model when it sounds confident.",
        "Grant permanent administrator access.",
      ],
      0,
      "Authorization belongs in the surrounding system, not the model.",
    ),
  ],
  LLM04: [
    trueFalse(
      "Models, datasets, libraries, and services are all part of an AI system's supply chain.",
      true,
      "Every external component and deployment step adds supply-chain risk.",
    ),
    multipleChoice(
      "Which practice best reduces AI supply-chain risk?",
      [
        "Download the newest model automatically.",
        "Verify suppliers and pin approved component versions.",
        "Trust any component that passes one scanner.",
      ],
      1,
      "Verified sources and pinned versions prevent silent changes.",
    ),
    multipleChoice(
      "A compromised public model passes checks and reaches production. What failed?",
      [
        "Output formatting",
        "Rate limiting",
        "Supply-chain controls",
      ],
      2,
      "External models are part of the software supply chain.",
    ),
  ],
  LLM05: [
    trueFalse(
      "A poisoned model may behave normally until a hidden trigger activates it.",
      true,
      "Backdoors can remain dormant during ordinary testing.",
    ),
    multipleChoice(
      "What most improves recovery from Data and Model Poisoning?",
      [
        "Keep verified histories and clean versions of data and models.",
        "Allow unrestricted automatic retraining.",
        "Discard information about where training data came from.",
      ],
      0,
      "Provenance and clean versions make rollback possible.",
    ),
    multipleChoice(
      "How can a team catch poisoning during model updates?",
      [
        "Test only whether the model file loads.",
        "Monitor behavior and test for hidden triggers.",
        "Approve every update from a public repository.",
      ],
      1,
      "Behavior tests can reveal changes that file checks miss.",
    ),
  ],
  LLM06: [
    trueFalse(
      "A request-rate limit always prevents an agent from running up a large bill.",
      false,
      "One request can trigger extensive reasoning or tool use.",
    ),
    multipleChoice(
      "Which event is Unbounded Consumption?",
      [
        "A tool traps an agent in millions of API calls.",
        "A model reveals an API key from its context.",
        "A supplier publishes a compromised model.",
      ],
      0,
      "Runaway tool use can exhaust resources and inflate costs.",
    ),
    multipleChoice(
      "Which limits should be set before an agent starts?",
      [
        "Only a maximum prompt length",
        "Only a daily request count",
        "Budgets for tokens, actions, time, and spending",
      ],
      2,
      "Multiple hard budgets contain different kinds of resource use.",
    ),
  ],
  LLM07: [
    trueFalse(
      "Important model claims should be verified before they trigger real-world actions.",
      true,
      "Fluency and confidence do not verify truth.",
    ),
    multipleChoice(
      "Which situation is Misinformation?",
      [
        "An agent reports a backup succeeded even though it never ran.",
        "An agent makes too many tool calls.",
        "A vector search crosses customer boundaries.",
      ],
      0,
      "The false report could cause harmful decisions.",
    ),
    multipleChoice(
      "What should happen before acting on an important model claim?",
      [
        "Accept it if the wording is detailed.",
        "Verify the evidence and current system state.",
        "Ask the same model to repeat it.",
      ],
      1,
      "Important claims need evidence independent of the model's confidence.",
    ),
  ],
  LLM08: [
    trueFalse(
      "A hidden system prompt is a safe place to store an API key.",
      false,
      "Assume model context can be discovered.",
    ),
    multipleChoice(
      "Where should access rules be enforced?",
      [
        "In application permissions outside the model",
        "Only in hidden model instructions",
        "In a warning included with every user prompt",
      ],
      0,
      "Security controls must still work if hidden context is exposed.",
    ),
    multipleChoice(
      "Why can revealing hidden tool details be dangerous?",
      [
        "It always increases token costs.",
        "It gives attackers a map of privileged capabilities.",
        "It permanently changes the model's weights.",
      ],
      1,
      "Exposed capabilities help attackers plan their next move.",
    ),
  ],
  LLM09: [
    trueFalse(
      "Filtering search results after retrieval can still expose clues about another user's data.",
      true,
      "Authorization must be enforced during retrieval.",
    ),
    multipleChoice(
      "When should a vector search enforce document permissions?",
      [
        "During every retrieval",
        "Only after results reach the model",
        "Only when the vector store is created",
      ],
      0,
      "Unauthorized data should never enter the result set.",
    ),
    multipleChoice(
      "How should stored embeddings be protected?",
      [
        "As harmless mathematical values",
        "Only when they contain readable text",
        "Like the sensitive source documents they represent",
      ],
      2,
      "Embeddings can leak or help reconstruct source information.",
    ),
  ],
  LLM10: [
    trueFalse(
      "Model-generated output is safe to execute because the model created it.",
      false,
      "Attackers may influence model output.",
    ),
    multipleChoice(
      "How should an application handle model-generated content?",
      [
        "Trust it after a successful model response.",
        "Validate and encode it for its exact destination.",
        "Remove spaces and execute it immediately.",
      ],
      1,
      "Each destination needs its own validation and encoding.",
    ),
    multipleChoice(
      "A chat app loads a model-generated image link that leaks the conversation. What is the core mistake?",
      [
        "The app acted on untrusted model output.",
        "The model used too many tokens.",
        "The vector search returned too many results.",
      ],
      0,
      "Model output must be checked before a connected system uses it.",
    ),
  ],
  CAPSTONE: [
    multipleChoice(
      "A document hides instructions that redirect a summarizer. Which vulnerability is this?",
      [
        "Prompt Injection",
        "Misinformation",
        "Unbounded Consumption",
      ],
      0,
      "Untrusted content changed the model's intended behavior.",
    ),
    multipleChoice(
      "An assistant can delete production records even though it only needs to read them. Which vulnerability is this?",
      [
        "Sensitive Information Disclosure",
        "Excessive Agency",
        "Supply Chain",
      ],
      1,
      "The assistant has more power than its task requires.",
    ),
    multipleChoice(
      "A model-generated image link sends private chat data to an attacker. Which vulnerability is this?",
      [
        "Vector and Embedding Weaknesses",
        "Data and Model Poisoning",
        "Improper Output Handling",
      ],
      2,
      "The application acted on untrusted model output.",
    ),
  ],
};

export function buildLevelQuiz(levels, levelIndex) {
  const riskCode = levels[levelIndex]?.riskCode;
  return QUESTION_BANK[riskCode] ?? [];
}

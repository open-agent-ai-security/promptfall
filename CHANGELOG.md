<!--
  Copyright 2026 Exabeam, Inc.
  SPDX-License-Identifier: Apache-2.0
-->

# Changelog

Notable changes to Promptfall. The published site deploys from `main`, so the
latest deployment is the only supported version; entries here mark the tagged
releases.

## [1.0.0] — 2026-08-10

First stable release. Promptfall [launched publicly on 2026-08-05](https://open-agent-ai-security.github.io/blog/promptfall-launch/);
this release locks in the launch feature set plus the post-beta polish pass.

### Added
- **Level-end quizzes** in arcade style, drawn from a 33-question bank, with
  animated feedback, input-advanced flow, and a replay-the-level choice after
  each quiz.
- **Arcade pause mode** — pausing freezes the action while keeping learning
  hints readable.
- **Health crates** in level one and the Gauntlet.

### Changed
- **Quiz content rewritten for conceptual learning** — questions test the idea,
  not the wording of the lesson.
- **Mobile controls redesigned** as on-screen gamepad controls with larger hit
  targets, a simplified HUD, and an extended mute control; jump height is
  preserved across control schemes.
- **Level and title backgrounds optimized** and lazily preloaded for faster
  loads.

### Fixed
- Mobile jump audio, sticky quiz-answer hover on touch, and assorted control
  edge cases.

## [1.0.0-beta.2] — 2026-07-27

Bug-fix and quality pass following Beta 1.

- Hardened keyboard and touch input handling, including recovery from
  interrupted and stuck controls.
- Longer player-hit invincibility for clearer, fairer damage recovery.
- Adaptive educational callout timing for both learning-focused and fast-moving
  players.
- Self-healing soundtrack playback with stall detection, browser lifecycle
  recovery, and gesture retry.
- Expanded automated coverage with mocked input and audio lifecycle tests;
  zero-warning linting and CI quality gates for GitHub Pages deployments.

## [1.0.0-beta.1] — 2026-07-26

First public beta.

- Eleven playable levels covering the 2026 OWASP Top 10 for LLM Applications,
  plus the Gauntlet capstone with moving platforms, energy traps, and a full
  victory sequence.
- Educational definitions, examples, and mitigations integrated into gameplay.
- Original Praxi animation, enemy art, environments, music, and sound effects.
- Keyboard and touch controls with responsive mobile layouts.
- GitHub Pages deployment.

[1.0.0]: https://github.com/open-agent-ai-security/promptfall/releases/tag/v1.0.0
[1.0.0-beta.2]: https://github.com/open-agent-ai-security/promptfall/releases/tag/v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/open-agent-ai-security/promptfall/releases/tag/v1.0.0-beta.1

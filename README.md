# Promptfall

**Ten vulnerabilities. One hero. Learn the OWASP Top 10 for LLMs.**

Promptfall is a modern browser platformer celebrating the 2026 OWASP Top 10 for
LLM Applications. Guide Praxi through each level, stomp the animated threats,
and collect concise definitions, examples, and defenses without interrupting
the action.

The current playable includes:

- Level 1: LLM01 Prompt Injection
- Level 2: LLM02 Sensitive Information Disclosure
- Level 3: LLM03 Excessive Agency
- Six educational encounters per level
- Keyboard and touch controls
- Responsive 16:9 game presentation
- Static hosting support for GitHub Pages or any ordinary web server

## Controls

- Move: `A` / `D` or Left / Right Arrow
- Jump: `W`, Up Arrow, or Space
- Sound toggle: `M`
- Mobile: on-screen movement and jump controls

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown by the development server.

## Build

Build the static GitHub Pages-ready version:

```bash
npm run build:static
```

The static game is written to `outputs/promptfall-game`.

Run the production application build and tests:

```bash
npm run build
node --test tests/rendered-html.test.mjs
```

## Project structure

- `app/Game.tsx` — game state, physics, encounters, and campaign flow
- `app/globals.css` — splash, title, HUD, announcements, and responsive styling
- `public/assets` — Praxi sprites, enemies, environments, and community branding
- `static` — static-build entry point
- `tests` — rendered-shell and accessibility checks

Sponsored by the Open Agent and AI Security Community.

## License

Promptfall source code, original game artwork, and original documentation are
licensed under the [Apache License 2.0](LICENSE).

Educational material distilled from the OWASP Top 10 for LLM Applications 2026
is used under the Creative Commons Attribution-ShareAlike 4.0 International
License. See [NOTICE](NOTICE) for source attribution and scope.

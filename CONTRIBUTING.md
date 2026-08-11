<!--
  Copyright 2026 Exabeam, Inc.
  SPDX-License-Identifier: Apache-2.0
-->

# Contributing to Promptfall

Thanks for helping improve Promptfall. Contributions are welcome via pull
request — code, levels, lesson content, quiz questions, art, and music all live
in this repo, and all of them are fair game.

## License

Promptfall is licensed under the [Apache License, Version 2.0](LICENSE). By
contributing, you agree that your contributions are licensed under the same
terms.

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/)
instead of a CLA — a lightweight way to certify you wrote the contribution, or
otherwise have the right to submit it under the project's license.

Add a `Signed-off-by` line to every commit. Git adds it for you with `-s`:

```
git commit -s -m "Your commit message"
```

The name and email must be a known identity — your real name, or an established
identity you're known by in the community (a long-standing handle counts),
reachable at the address you sign with. Anonymous or throwaway identities aren't
accepted.

## How to contribute

- **Base branch is `main`.** The published game deploys from `main` via GitHub
  Pages, so whatever merges is live within minutes.
- **Open an issue first for anything substantial** — a new level mechanic, a
  content rewrite, a dependency swap — so we can agree on direction before you
  invest the time. Typo-level fixes can go straight to a PR.
- **Educational content accuracy matters most.** The lessons, quizzes, and key
  insights teach the OWASP Top 10 for LLM Applications; content changes should
  stay faithful to the [published OWASP material](https://genai.owasp.org/llm-top-10/).
  Cite your source in the PR when you correct or update a claim.
- **Run the checks locally** before pushing: `npm ci && npm run lint && npm test`.
  CI runs the same gates, plus the Pages build.

## Versioning

Promptfall versions mark meaningful releases of the game (see
[CHANGELOG.md](CHANGELOG.md)), but the only distribution channel is the
published site — the latest deployment is the only supported version. There is
deliberately no `STABILITY.md` here: unlike Praxen and Observra, Promptfall
exposes no API, schema, or event stream for downstream consumers to pin
against.

## Code of conduct

All project spaces are covered by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Security problems go through a private channel, not a public issue — see
[SECURITY.md](SECURITY.md).

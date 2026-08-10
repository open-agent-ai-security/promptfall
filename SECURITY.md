<!--
  Copyright 2026 Exabeam, Inc.
  SPDX-License-Identifier: Apache-2.0
-->

# Security Policy

Promptfall is a static browser game published by a security community — so its
own security posture should hold up to scrutiny. This document describes what is
in scope, how to report a vulnerability privately, and what to expect.

## Security model

Promptfall is deliberately simple: **static files served from GitHub Pages**.
There is no backend, no database, no account system, and no user-generated
content. The public site runs cookieless pageview counters (GoatCounter and
Cloudflare Web Analytics) and stores nothing about players. That keeps the
attack surface small — but not zero.

## Scope

**In scope** — vulnerabilities in Promptfall itself:

- **Script injection / XSS** — any path where game content (level data, lesson
  text, quiz content, song lyrics) or URL parameters reach the DOM unsafely.
- **Supply chain** — the npm dependency tree, the build pipeline, and anything
  that could alter what ships to the published site.
- **CI / deployment** — the GitHub Actions workflows that build and deploy to
  Pages, including secrets handling and permissions.
- **Third-party embeds** — the analytics beacons: anything that would let them
  execute beyond their documented, cookieless pageview role.

**Out of scope:**

- Gameplay bugs, balance issues, and broken levels — file a regular
  [issue](https://github.com/open-agent-ai-security/promptfall/issues).
- Accuracy of the OWASP educational content — also a regular issue; we want the
  report, just not through the security channel.
- Availability of GitHub Pages itself.

## Reporting a vulnerability

**Do not file a public GitHub issue for a security vulnerability.** Use GitHub's
private security advisory:

1. Go to the [Security tab](https://github.com/open-agent-ai-security/promptfall/security)
   on this repository.
2. Click **Report a vulnerability**.
3. Include enough detail to reproduce — the page, the input or content path
   involved, the observed behavior, and browser/OS if relevant.

GitHub will create a private advisory thread between you and the project
maintainers. If GitHub Security Advisories are unavailable to you for any
reason, email **developer@exabeam.com** with the subject line
**`Promptfall security report`** and the same level of detail.

## What to expect

- We aim to acknowledge reports within a few business days.
- Confirmed vulnerabilities are fixed in the live site (it deploys from `main`,
  so fixes ship as soon as they merge) and credited in the release notes unless
  you prefer otherwise.
- Since the only distribution channel is the published site, there are no old
  versions to patch: **the latest deployment is the only supported version.**

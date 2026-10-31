# Changelog

## 0.1.4 — 2026-10-31

- Require an exact, nonempty `OPEN_BOT_PAGE_TOKEN` match on every endpoint except
  `/healthz`, including loopback callers and development previews. Missing,
  incorrect, and fixed preview credentials no longer bypass authentication.
- Protect the HTML route as well as API routes, preventing unauthenticated
  callers from obtaining the embedded page token through Bun's static routes.
- Preserve the exact token when embedding it in HTML, with safe JSON escaping.
- Add isolated HTTP regression tests for checkout and frozen UI modes, render
  submission, render history, video downloads, and fail-closed startup.

## 0.1.3

- Retry transient dashboard connection failures automatically.

## 0.1.2

- Replace only the quoted UI token placeholder to keep bundled JavaScript valid.

## 0.1.1

- Require an exact configured production token on the page-server API.

## 0.1.0

- Initial release.

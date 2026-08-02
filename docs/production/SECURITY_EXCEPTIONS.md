# Security exception register

## SEC-2026-001 — React Router RSC-only advisory

- Status: approved temporarily for the pre-production branch.
- Advisory: `GHSA-qwww-vcr4-c8h2`.
- Installed version: `react-router-dom` and `react-router` 7.18.2.
- Scope: the advisory affects React Server Components action handling. Typing Master is a Vite client-only application using `HashRouter`; it has no RSC routes, server actions, SSR, or React Router server runtime.
- Decision: keep 7.18.2 because the npm-suggested 7.11.0 downgrade reintroduces multiple high-severity redirect, XSS, deserialization, and denial-of-service advisories.
- Compensating controls: exact package pin, lockfile, client-only build contract, CSP, dependency-policy CI check, and no server-action endpoints.
- Owner: release owner.
- Expiry: 2026-09-01, or immediately when a supported patched version is published, whichever is earlier.
- Release rule: `scripts/checkDependencyPolicy.mjs` fails when the version, advisory set, or expiry differs.

No other high or critical dependency finding is approved.

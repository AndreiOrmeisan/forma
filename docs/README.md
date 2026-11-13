# FORMA documentation — start here

This directory is the shared context pack for developers and coding agents. Read it before changing code or installing new services. Technical documentation and code are English; communicate with the project owner and write application UI in Romanian.

## Reading order

1. [Agent handoff](agent-handoff.md): current scope, pending activation, restrictions and known limitations.
2. [INIT — laptop setup](INIT.md): required installations, clean checkout, environments, two-terminal startup and verification.
3. [Services and deployment](services-and-deployment.md): repository, live addresses, dashboards, environment-variable ownership and publishing.
4. [Architecture](architecture.md): routes, code ownership, state, backend boundaries and extension strategy.
5. Read the relevant feature reference before editing its code.

## Feature references

| Document | Use it for |
| --- | --- |
| [Wardrobe engine](wardrobe-engine.md) | Input ranges, construction profile, geometry, banding and provisional hardware rules |
| [Pricing and future suppliers](future-supplier-pricing.md) | Manual price catalog, Decimal rounding, allowances, markup and provider boundary |
| [Project persistence](project-persistence.md) | Local SQLite, project schemas/revisions, CRUD, historical compatibility and backups |
| [Browser project saving](browser-projects.md) | Current default POC mode, localStorage limits, integrity and later API switch |
| [Supplier catalog](supplier-catalog.md) | Local supplier CRUD, reusable preferred prices, project snapshots and JSON backup |
| [PDF export](pdf-export.md) | Local quotation/workshop PDFs, company profile/logo, privacy boundaries and sample QA |
| [Free online setup](free-online-setup.md) | Owner's Supabase Free / Google OAuth setup, SQL migration and activation checks |
| [Troubleshooting](troubleshooting.md) | Common Windows, Next.js, Render, auth and project-saving failures |

The root [README](../README.md) is the short entry point. Root [AGENTS.md](../AGENTS.md) remains in its standard discovery location and holds engineering rules. [frontend/AGENTS.md](../frontend/AGENTS.md) also contains Next.js-generated instructions; preserve its generated block. These entry points link here rather than duplicating the complete onboarding pack.

## Source of truth and maintenance

- Frontend dependencies: [package.json](../frontend/package.json) and [package-lock.json](../frontend/package-lock.json).
- Backend dependencies: [pyproject.toml](../backend/pyproject.toml); compatible ranges are not a Python lockfile.
- Settings: [.env.example](../.env.example), [backend config](../backend/src/forma/config.py), [Next config](../frontend/next.config.ts) and [Pages workflow](../.github/workflows/deploy-pages.yml).
- API contracts and rules: actual Pydantic/domain modules and their tests. Docs describe them; docs do not override the implementation.
- External account state: confirm with the owner and relevant dashboards. Code support does not prove a service has been configured, pushed or deployed.

Update the corresponding documents whenever routes, setup commands, variables, calculation versions, hosting or security boundaries change. Record what was actually verified. Never add real passwords, tokens, private keys or database contents to documentation. Keep onboarding here; do not scatter additional setup guides across the source tree.

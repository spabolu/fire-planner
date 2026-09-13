<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- Use Node.js 24 LTS locally, in GitHub Actions, and on Azure.
- Keep YNAB read-only and live-first, with a clearly labeled saved-data fallback.
- Keep personal inputs, database credentials, and YNAB tokens out of source control and build artifacts.
- Azure deployments require owner-restricted App Service Easy Auth; never trust identity headers on an unprotected public Node server.

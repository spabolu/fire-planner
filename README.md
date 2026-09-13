# Savings and financial independence planner

Next.js App Router and Fluent UI app for savings, estimated take-home pay, and
financial independence planning. Use **Node.js 24 LTS** locally and on Azure.
This public repository contains code and a fictional example, not personal data.

```bash
npm install
npm run setup
npm run dev
```

Open http://127.0.0.1:3000. For production mode, run `npm run build` followed by
`npm start`. Both local servers bind to loopback. Cloud deployments require
owner-restricted Azure authentication as described below.

## Private data and scenarios

`npm run setup` creates `.local/seed.json` from `data/example-seed.json` without
overwriting an existing seed. Replace the fictional example with your own inputs
before relying on results. The server validates the file rather than silently
inventing balances. Private inputs, `.env.local`, database files, and deployment
artifacts are excluded from git.

Without `DATABASE_URL`, scenarios and snapshots use local JSON files. With
`DATABASE_URL`, the same interface uses PostgreSQL, a small connection pool, and
certificate-verified TLS. Database errors never silently fall back to local files.
Unsaved edits remain in the current tab. Account treatment changes affect only
this planner. The app never changes YNAB transactions or budget assignments.

```bash
# Set DATABASE_URL privately in .env.local first.
npm run db:migrate
npm run db:import
```

Run the import from a trusted local machine with its firewall access enabled,
not in a public workflow with personal files. It loads `.local/seed.json` and
optional `.local/settings.json` / `.local/accounts.json` transactionally,
without overwriting existing database documents.

PostgreSQL stores three validated JSONB documents (`seed`, `settings`, `accounts`).
The typed application model remains the source of truth without an additional
ORM. Import personal seed data privately into the database, never through
GitHub Actions artifacts. The application database role must not be a server admin.

Account loading is **live-first**: every authenticated page load requests YNAB balances
using `YNAB_ACCESS_TOKEN` from `.env.local`, then saves the successful response.
The stored snapshot is used only if no token is configured or YNAB is unavailable
(including network errors, timeouts, or rejected responses). The header and a
warning explicitly identify fallback data and retain its original timestamp.
Manual refresh retries without discarding the current scenario.

Configure `.env.local` privately (see `.env.example`); never use a `NEXT_PUBLIC_`
variable for credentials. The sole YNAB request is
`GET /v1/plans/{plan_id}/accounts`. The CLI's MCP authorization is not copied into
the app. Local storage failures and unexpected programming errors surface rather
than being disguised as successful snapshot fallback.

References: [official YNAB API](https://api.ynab.com/) and
[YNAB MCP server](https://github.com/rgarcia/ynab-mcp-server). The web app calls the
API directly; CLI budget tasks use the MCP tools. The app's `YNAB_ACCESS_TOKEN`
setting is separate from the MCP server's `YNAB_API_TOKEN` setting.

## What the models mean

- Payroll: existing salary/bonus, traditional versus Roth, HSA, employer match,
  after-tax 401(k), IRA, ESPP, brokerage, reserves, and WA payroll assumptions.
  Estimated annual liability is not an ADP withholding forecast.
- 2027 caps are explicitly provisional. Tax brackets and Social Security base
  remain labeled 2026 reference assumptions.
- FIRE: Lean, regular, Fat, Coast, and Barista targets; constant real-return
  accumulation; milestone ages and required recurring investment. Contributions
  use the savings planner, with finite dated RSU additions counted once.
- Cash, vehicles, other non-investment assets, and unvested shares do not count
  toward the FI portfolio by default. A conservative optional debt reserve is
  deducted once; this is not a debt-amortization or asset-sale simulation.
- Barista assumes continued part-time income. Coast assumes no further savings
  are needed after the Coast threshold to reach the later retirement target.
  Neither is equivalent to immediate full financial independence.
- The emergency reserve is explicitly designated, not inferred from checking.
  Early-access Roth basis, account holdings, withdrawal taxes, and sequence-of-
  returns risk need separate analysis.

```bash
npm test
npm run lint
npm run build
```

## Azure deployment and CI/CD

The supplied infrastructure uses one Linux App Service B1 instance, Node 24 LTS,
and a PostgreSQL Flexible Server B1ms with 32 GiB storage and seven-day backups.
No high availability or replica is configured for this single-user app.
Approximate West US 3 retail cost at 730 hours/month: $12.41 app hosting plus
$16.09 PostgreSQL compute/storage, or **$28.50/month**, excluding taxes, excess
backup/network usage, and subscription credits. Prices can change.

`infra/main.bicep` defines hosting, database, HTTPS, and owner-only Easy Auth.
Provision it separately from application deployments. Secure parameter files
must stay outside git. Database firewall rules should allow only the web app's
outbound IPs and any temporary administration IP, not all Azure resources.

Authentication requires:

1. A single-tenant Microsoft Entra app registration with the web redirect URI
   `https://<app-name>.azurewebsites.net/.auth/login/aad/callback`.
2. A dedicated user-assigned identity attached to the web app. Its principal
   is trusted by the sign-in registration through a federated credential
   (`api://AzureADTokenExchange` audience). Easy Auth uses its client ID through
   `OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID`, avoiding an expiring login secret.
3. Easy Auth enabled with authentication required and an allowed-principal
   policy restricted to the owner's tenant object ID. Only `/api/health` is public.
4. `APP_AUTH_MODE=azure`, comma-separated `APP_ALLOWED_PRINCIPAL_IDS`, and the exact HTTPS
   `APP_ORIGIN` configured on the app. The application independently checks the
   owner on pages and APIs. Azure strips and supplies the identity headers;
   these headers are **not** trusted on a directly exposed Node server.

### Allow another user later

First add or invite the person into the same Microsoft Entra tenant. Then use
their tenant **object ID**, not an email address:

```bash
node scripts/azure-allow-user.mjs <resource-group> <app-name> <user-object-id>
```

The helper updates both the Easy Auth principal allowlist and the application
allowlist, preserving existing access. Keep additional IDs in the private
`additionalUserObjectIds` Bicep parameter so a later infrastructure deployment
does not reset access.

**This grants access to the same shared financial planner and its saved data.**
It does not create isolated accounts, read-only roles, or a multi-user budgeting
service. To revoke access, remove the ID from both allowlists and the private
infrastructure parameters.

The `CI` workflow checks lint, unit tests, PostgreSQL migrations/persistence,
production dependencies, and a standalone build on pull requests. Only trusted
`main` builds deploy, using short-lived GitHub OIDC tokens:

- GitHub environment: `production`, restricted to branch `main`.
- Environment secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- Environment variables: `AZURE_WEBAPP_NAME`, `APP_URL`.
- Deployment identity: Website Contributor on this web app only.
- Federated subject: `repo:<owner>/<repo>:environment:production`.

The standalone artifact excludes local inputs, credentials, and PDFs. Azure
runs the schema migration before starting the app. YNAB and database credentials
stay in Azure app settings, never in GitHub artifacts. Protect the Azure account
and deployment identity: they can change authentication and application code.

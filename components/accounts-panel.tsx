"use client";

import {
  Button,
  MessageBar,
  MessageBarBody,
  Select,
} from "@fluentui/react-components";
import { ACCOUNT_KINDS, type accountTotals } from "@/lib/accounts";
import { exactMoney, money } from "@/lib/format";
import type { AccountKind, AccountSnapshot, FireInputs } from "@/lib/types";
import { isAccountKind } from "@/lib/validation";
import { Metric } from "./controls";

interface Props {
  snapshot: AccountSnapshot;
  kinds: Record<string, AccountKind>;
  totals: ReturnType<typeof accountTotals>;
  fire: FireInputs;
  emergencyTarget: number;
  match: number;
  maximumMatch: number;
  canRefresh: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onKind: (id: string, kind: AccountKind) => void;
}
export function AccountsPanel({
  snapshot,
  kinds,
  totals,
  fire,
  emergencyTarget,
  match,
  maximumMatch,
  canRefresh,
  refreshing,
  onRefresh,
  onKind,
}: Props) {
  return (
    <section aria-label="Accounts and foundations">
      <div className="section-toolbar">
        <div>
          <h2>Assets, liabilities & financial foundations</h2>
          <p className="muted">
            YNAB balances captured {snapshot.fetchedAt.slice(0, 10)}. Account
            balance includes cleared and uncleared entries.
          </p>
        </div>
        <Button onClick={onRefresh} disabled={!canRefresh || refreshing}>
          {refreshing ? "Refreshing..." : "Refresh from YNAB"}
        </Button>
      </div>
      <div className="metrics four">
        <Metric label="Assets" value={money(totals.assets)} />
        <Metric label="Liabilities" value={money(totals.liabilities)} />
        <Metric
          label="Net worth"
          value={money(totals.netWorth)}
          tone="accent"
        />
        <Metric
          label="Gross cash"
          value={money(totals.cash)}
          detail="May already be assigned to bills and card payments."
        />
      </div>
      <MessageBar intent="info">
        <MessageBarBody>
          {canRefresh
            ? "The app requests live YNAB balances whenever it opens. The saved snapshot is only a fallback if that request fails. Refresh is read-only: no transactions, transfers, or budget assignments change."
            : "Live loading is the default, but no token is configured. The app is using its saved snapshot. Put YNAB_ACCESS_TOKEN in .env.local and restart; the token stays server-side."}
        </MessageBarBody>
      </MessageBar>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Balance</th>
                <th>FIRE treatment</th>
                <th>APR</th>
                <th>Monthly minimum</th>
                <th>Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.accounts.map((account) => (
                <tr key={account.id}>
                  <th scope="row">
                    {account.name}
                    {account.closed ? " (closed)" : ""}
                    {account.importError ? " - import needs attention" : ""}
                  </th>
                  <td className={account.balance < 0 ? "negative-text" : ""}>
                    {exactMoney(account.balance)}
                  </td>
                  <td>
                    <Select
                      aria-label={`${account.name} FIRE treatment`}
                      value={kinds[account.id] ?? account.kind}
                      onChange={(_, data) => {
                        if (isAccountKind(data.value))
                          onKind(account.id, data.value);
                      }}
                    >
                      {ACCOUNT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    {account.apr === null ? "Unknown" : `${account.apr}%`}
                  </td>
                  <td>
                    {account.minimumPayment === null
                      ? "Unknown"
                      : exactMoney(account.minimumPayment)}
                  </td>
                  <td>
                    {account.lastReconciledAt?.slice(0, 10) ?? "Not supplied"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Net worth</th>
                <td>{exactMoney(totals.netWorth)}</td>
                <td colSpan={4}>
                  Assets minus every negative balance, regardless of category.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="muted">
          Cash, vehicles, property, and other non-investment assets are excluded
          from FIRE by default. Account treatment only changes this planner
          model. It does not change YNAB. HSA is included only when enabled;
          retirement balances are not assumed immediately accessible.
        </p>
        <p className="muted">
          Known loan minimums: {money(totals.loanMinimums)}/month. Unknown
          credit-card APRs, statement obligations, and minimums are not
          invented. The snapshot does not contain security-level holdings, so
          single-stock concentration cannot be measured from account names
          alone.
        </p>
      </div>
      <div className="panel">
        <h3>Financial foundations before optimizing a FIRE date</h3>
        <div className="foundation-grid">
          <div>
            <h4>1. A cash-flow plan</h4>
            <p>
              Housing and food are supplied estimates; remaining spending needs
              refinement. Keep current bills and near-term purchases funded.
            </p>
          </div>
          <div>
            <h4>2. An accessible emergency fund</h4>
            <p>
              {money(fire.emergencyCash)} designated against a{" "}
              {money(emergencyTarget)} target.{" "}
              {money(Math.max(0, emergencyTarget - fire.emergencyCash))}{" "}
              remains. Checking balance alone does not establish emergency
              reserves.
            </p>
          </div>
          <div>
            <h4>3. Understand debt and match</h4>
            <p>
              {money(totals.liabilities)} of liabilities. Check unknown card
              terms before assuming balances are low-interest. The scenario
              captures {money(match)} of a {money(maximumMatch)} assumed annual
              match.
            </p>
          </div>
          <div>
            <h4>4. Invest for the right time horizon</h4>
            <p>
              Money for near-term purchases should not depend on stock returns.
              FI growth excludes cash reserves and non-investment assets and
              does not assume new RSU grants.
            </p>
          </div>
        </div>
        <p className="muted">
          A planning checklist, not an instruction to pay a particular debt or
          change an investment. The right trade-off depends on interest,
          liquidity, matching, taxes, and your goals.
        </p>
        <div className="source-links">
          <a
            href="https://ericvanular.com/financial-independence/"
            target="_blank"
            rel="noreferrer"
          >
            Eric van Ular: budget, emergency reserves, debt, and investing
          </a>
          <a
            href="https://choosefi.com/financial-independence#framework"
            target="_blank"
            rel="noreferrer"
          >
            ChooseFI framework (provided reference; automated access was
            unavailable)
          </a>
        </div>
      </div>
    </section>
  );
}

"use client";

import {
  Button,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
} from "@fluentui/react-components";
import { useMemo, useState } from "react";
import { accountTotals } from "@/lib/accounts";
import { buildFirePlan } from "@/lib/fire";
import { money } from "@/lib/format";
import {
  calculate,
  normalize,
  PROJECTED_2027,
  REFERENCE,
  taxes,
} from "@/lib/planner";
import type {
  AccountKind,
  AccountStatus,
  AppSettings,
  FireInputs,
  PlannerInputs,
  PlanningData,
} from "@/lib/types";
import { isRecord, isSnapshot } from "@/lib/validation";
import { AccountsPanel } from "./accounts-panel";
import { FirePanel } from "./fire-panel";
import { PlannerPanel } from "./planner-panel";

interface Notice {
  intent: "success" | "error" | "info";
  text: string;
}
function cleanPlanner(
  input: PlannerInputs,
  award: PlanningData["award"],
): PlannerInputs {
  const { rsu: _derivedRsu, ...clean } = normalize(input, award);
  return clean;
}
async function responsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error(
      `Server returned an unexpected response (HTTP ${response.status}). No successful save or refresh was confirmed.`,
    );
  }
  if (!response.ok)
    throw new Error(
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : `Request failed (HTTP ${response.status}).`,
    );
  return data;
}
export function Dashboard({
  initialData,
  initialAccountStatus,
  liveYnabEnabled,
}: {
  initialData: PlanningData;
  initialAccountStatus: AccountStatus;
  liveYnabEnabled: boolean;
}) {
  const [settings, setSettings] = useState<AppSettings>(initialData.settings);
  const [savedSettings, setSavedSettings] = useState<AppSettings>(
    initialData.settings,
  );
  const [snapshot, setSnapshot] = useState(initialData.snapshot);
  const [accountStatus, setAccountStatus] = useState(initialAccountStatus);
  const [tab, setTab] = useState("planner");
  const [period, setPeriod] = useState<"annual" | "monthly" | "paycheck">(
    "annual",
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dirty = settings !== savedSettings;
  const result = useMemo(
    () => calculate(settings.planner, initialData.award),
    [settings.planner, initialData.award],
  );
  const totals = useMemo(
    () =>
      accountTotals(
        snapshot.accounts,
        settings.accountKinds,
        settings.fire.includeHsa,
        settings.fire.reserveDebt,
      ),
    [
      snapshot.accounts,
      settings.accountKinds,
      settings.fire.includeHsa,
      settings.fire.reserveDebt,
    ],
  );
  const fireContext = useMemo(() => {
    const f = settings.fire;
    const grossPartTime = f.partTimeHourly * f.partTimeHours * f.partTimeWeeks;
    const partTimeTax = taxes(grossPartTime, 0, 0, 0, 0, {
      ...settings.planner,
      taxableBenefits: 0,
      preTaxBenefits: 0,
    });
    const partTimeAnnualNet = Math.max(0, grossPartTime - partTimeTax.total);
    const annualInvestment = Math.max(
      0,
      result.employeeSavings +
        result.employer -
        result.s.reserve -
        (f.includeHsa ? 0 : result.s.hsa + result.employerHsa),
    );
    const asOf = new Date(snapshot.fetchedAt).getTime();
    const startYear = Number(snapshot.fetchedAt.slice(0, 4));
    const additionalByYear: Record<string, number> = {};
    for (const date of initialData.award.vestDates) {
      const vest = new Date(date).getTime();
      if (vest <= asOf) continue;
      const future = calculate(
        { ...settings.planner, year: Number(date.slice(0, 4)) },
        initialData.award,
      );
      const periodEndYear =
        startYear + Math.max(1, Math.ceil((vest - asOf) / (365.25 * 86400000)));
      additionalByYear[periodEndYear] =
        (additionalByYear[periodEndYear] ?? 0) + future.netRsu;
    }
    return {
      startingPortfolio: totals.startingPortfolio,
      annualInvestment,
      additionalByYear,
      startYear,
      partTimeAnnualNet,
    };
  }, [
    settings.planner,
    settings.fire,
    result,
    totals.startingPortfolio,
    snapshot.fetchedAt,
    initialData.award,
  ]);
  const fireResult = useMemo(
    () => buildFirePlan(settings.fire, fireContext),
    [settings.fire, fireContext],
  );
  const monthlyCushion =
    result.spendable / 12 - fireResult.regularMonthly - totals.loanMinimums;

  function changePlanner(patch: Partial<PlannerInputs>) {
    setSettings((previous) => {
      const requested = { ...previous.planner, ...patch };
      return {
        ...previous,
        planner: cleanPlanner(requested, initialData.award),
      };
    });
  }
  function changeYear(year: number) {
    if (year !== 2026 && year !== 2027) {
      setNotice({
        intent: "error",
        text: "Choose the 2026 reference or 2027 planning year.",
      });
      return;
    }
    changePlanner({ ...(year === 2027 ? PROJECTED_2027 : REFERENCE), year });
  }
  function preset(which: "core" | "maximum" | "cash") {
    const s = result.s;
    const requested = {
      ...s,
      regular: s.regularLimit,
      rothPercent: 0,
      hsa: s.hsaEligible ? Math.max(0, s.hsaLimit - s.employerHsa) : 0,
      ira: which === "cash" ? 0 : s.iraLimit,
      afterTax: which === "maximum" ? s.afterTaxLimit : 0,
      esppPercent: which === "cash" ? 0 : 15,
      esppSellPercent: 0,
      brokerage: 0,
      reserve: 0,
    };
    changePlanner(requested);
  }
  function changeFire(patch: Partial<FireInputs>) {
    setSettings((previous) => {
      const next = { ...previous.fire, ...patch };
      next.targetAge = Math.max(next.targetAge, next.currentAge);
      next.coastRetirementAge = Math.max(
        next.coastRetirementAge,
        next.currentAge,
      );
      return { ...previous, fire: next };
    });
  }
  function changeKind(id: string, kind: AccountKind) {
    setSettings((previous) => ({
      ...previous,
      accountKinds: { ...previous.accountKinds, [id]: kind },
    }));
  }
  async function save() {
    setSaving(true);
    setNotice(null);
    const requestedSettings = settings;
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestedSettings),
      });
      await responsePayload(response);
      setNotice({
        intent: "success",
        text: "Scenario saved privately. No YNAB data or external account settings changed.",
      });
      setSavedSettings(requestedSettings);
    } catch (error) {
      setNotice({
        intent: "error",
        text:
          error instanceof Error
            ? error.message
            : "Saving failed. No success was confirmed.",
      });
    } finally {
      setSaving(false);
    }
  }
  async function refresh() {
    setRefreshing(true);
    setNotice(null);
    try {
      const payload = await responsePayload(
        await fetch("/api/accounts", { method: "POST" }),
      );
      if (!isSnapshot(payload))
        throw new Error(
          "Unexpected account response. The displayed snapshot was not replaced.",
        );
      setSnapshot(payload);
      setAccountStatus({ mode: "live", message: null });
      setNotice({
        intent: "success",
        text: "Read-only YNAB account refresh completed. Your scenarios and account treatments were preserved.",
      });
    } catch (error) {
      setAccountStatus({
        mode: "fallback",
        message: `Live refresh failed. Continuing with the last successfully loaded balances. ${error instanceof Error ? error.message : "No successful refresh was confirmed."}`,
      });
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <h1>Savings & financial independence</h1>
          <p className="muted">
            Model savings choices, account balances, and a financial
            independence timeline with private scenario inputs.
          </p>
        </div>
        <div className="header-actions">
          <span
            className={`status-pill ${accountStatus.mode === "fallback" ? "fallback" : ""}`}
          >
            {accountStatus.mode === "live"
              ? "Live YNAB (read-only)"
              : "YNAB snapshot fallback"}
          </span>
          <Button appearance="primary" onClick={save} disabled={saving}>
            {saving
              ? "Saving..."
              : dirty
                ? "Save scenario changes"
                : "Save scenario"}
          </Button>
        </div>
      </header>
      <div className="snapshot-strip">
        <span>
          Net worth <strong>{money(totals.netWorth)}</strong>
        </span>
        <span>
          Investment assets <strong>{money(totals.investments)}</strong>
        </span>
        <span>
          Liabilities <strong>{money(totals.liabilities)}</strong>
        </span>
        <span>
          {accountStatus.mode === "live" ? "Refreshed" : "Snapshot from"}{" "}
          <strong>
            {snapshot.fetchedAt.replace("T", " ").replace("Z", " UTC")}
          </strong>
        </span>
      </div>
      <TabList
        selectedValue={tab}
        size="large"
        onTabSelect={(_, data) => {
          if (typeof data.value === "string") setTab(data.value);
        }}
        aria-label="Planner sections"
        className="main-tabs"
      >
        <Tab value="planner">Savings planner</Tab>
        <Tab value="fire">Financial independence</Tab>
        <Tab value="accounts">Accounts & foundations</Tab>
      </TabList>
      {accountStatus.mode === "fallback" && (
        <MessageBar intent="warning">
          <MessageBarBody>{accountStatus.message}</MessageBarBody>
        </MessageBar>
      )}
      {notice && (
        <MessageBar intent={notice.intent}>
          <MessageBarBody>{notice.text}</MessageBarBody>
        </MessageBar>
      )}
      {tab === "planner" && (
        <PlannerPanel
          result={result}
          award={initialData.award}
          profile={initialData.profile}
          onChange={changePlanner}
          onYearChange={changeYear}
          onPreset={preset}
          period={period}
          onPeriod={setPeriod}
        />
      )}
      {tab === "fire" && (
        <FirePanel
          inputs={settings.fire}
          result={fireResult}
          accounts={totals}
          monthlyCushion={monthlyCushion}
          annualInvestment={fireContext.annualInvestment}
          partTimeNet={fireContext.partTimeAnnualNet}
          onChange={changeFire}
        />
      )}
      {tab === "accounts" && (
        <AccountsPanel
          snapshot={snapshot}
          kinds={settings.accountKinds}
          totals={totals}
          fire={settings.fire}
          emergencyTarget={
            fireResult.leanMonthly * settings.fire.emergencyMonths
          }
          match={result.match}
          maximumMatch={settings.planner.matchLimit}
          canRefresh={liveYnabEnabled}
          refreshing={refreshing}
          onRefresh={refresh}
          onKind={changeKind}
        />
      )}
      <footer className="app-footer">
        Scenario estimates, not guaranteed returns or payroll forecasts. No
        trades, payments, or YNAB writes. The bundled example is fictional, and
        private files stay outside git. Use this through a shared authorized
        planner, not a public open app.
      </footer>
    </main>
  );
}

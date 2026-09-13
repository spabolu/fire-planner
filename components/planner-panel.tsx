"use client";

import {
  Button,
  Checkbox,
  Field,
  MessageBar,
  MessageBarBody,
  Select,
  Tab,
  TabList,
} from "@fluentui/react-components";
import { useId } from "react";
import { AllocationChart } from "@/components/charts";
import { Metric, NumberControl } from "@/components/controls";
import { exactMoney, money, percent } from "@/lib/format";
import { bounds, type PlannerResult } from "@/lib/planner";
import type { Award, PlannerInputs, Profile } from "@/lib/types";

type NumericKey = {
  [K in keyof PlannerInputs]: PlannerInputs[K] extends number ? K : never;
}[keyof PlannerInputs];

interface Props {
  result: PlannerResult;
  award: Award;
  profile: Profile;
  onChange: (patch: Partial<PlannerInputs>) => void;
  onYearChange: (year: number) => void;
  onPreset: (preset: "core" | "maximum" | "cash") => void;
  period: "annual" | "monthly" | "paycheck";
  onPeriod: (period: "annual" | "monthly" | "paycheck") => void;
}

export function PlannerPanel({
  result: r,
  award,
  profile,
  onChange,
  onYearChange,
  onPreset,
  period,
  onPeriod,
}: Props) {
  const id = useId();
  const limits = bounds(r.s, award);
  const divisor = period === "annual" ? 1 : period === "monthly" ? 12 : 24;
  const periodMoney = (value: number) => money(value / divisor);
  const controls: {
    key: NumericKey;
    label: string;
    max: number;
    step: number;
    suffix?: string;
    hint: string;
  }[] = [
    {
      key: "regular",
      label: "Regular 401(k)",
      max: limits.regular,
      step: 100,
      hint: `${money(r.traditional)} pre-tax + ${money(r.roth)} Roth. Assumed employer match adds ${money(r.match)}/year.`,
    },
    {
      key: "rothPercent",
      label: "Roth share of regular 401(k)",
      max: 100,
      step: 5,
      suffix: "%",
      hint: "0% means all Traditional/pre-tax. Both share one annual limit.",
    },
    {
      key: "hsa",
      label: "Employee HSA",
      max: limits.hsa,
      step: 50,
      hint: `${money(r.employerHsa)} employer funding also counts toward the combined limit.`,
    },
    {
      key: "ira",
      label: "Backdoor Roth IRA",
      max: limits.ira,
      step: 100,
      hint: "Nondeductible contribution, then conversion. Check pre-tax IRA balances first.",
    },
    {
      key: "afterTax",
      label: "Mega Backdoor Roth",
      max: limits.afterTax,
      step: 250,
      hint: "After-tax 401(k) source, then in-plan Roth conversion. No additional match.",
    },
    {
      key: "esppPercent",
      label: "ESPP payroll election",
      max: 15,
      step: 1,
      suffix: "%",
      hint: `${money(r.espp)} estimated annual purchase cost at a 10% discount. Actual caps depend on grant/purchase prices.`,
    },
    {
      key: "esppSellPercent",
      label: "ESPP shares sold after purchase",
      max: 100,
      step: 25,
      suffix: "%",
      hint: "0% keeps all shares. Sales add quarterly cash, not recurring paycheck income. RSUs stay invested.",
    },
    {
      key: "brokerage",
      label: "Taxable brokerage",
      max: 100000,
      step: 250,
      hint: "After-tax investing outside payroll. Include any ESPP proceeds you plan to reinvest here.",
    },
    {
      key: "reserve",
      label: "Cash / emergency-reserve additions",
      max: 50000,
      step: 250,
      hint: "Counts as savings, but not as invested contributions in the FIRE projection.",
    },
  ];
  const compensation: {
    key: NumericKey;
    label: string;
    max: number;
    suffix?: string;
  }[] = [
    { key: "salary", label: "Annual base salary", max: 1000000 },
    {
      key: "bonusPercent",
      label: "Expected bonus (not guaranteed)",
      max: 20,
      suffix: "%",
    },
    { key: "rsuPrice", label: "Assumed stock price at vest", max: 10000 },
    {
      key: "preTaxBenefits",
      label: "Pre-tax benefits & deductions / year",
      max: 10000,
    },
    {
      key: "taxableBenefits",
      label: "Non-cash taxable benefits / year",
      max: 10000,
    },
    {
      key: "otherPayroll",
      label: "Other after-tax deductions / year",
      max: 100000,
    },
    {
      key: "stateRate",
      label: "Effective state/local income tax",
      max: 20,
      suffix: "%",
    },
    {
      key: "waCaresRate",
      label: "State long-term-care payroll rate",
      max: 5,
      suffix: "%",
    },
  ];
  const ruleFields: { key: NumericKey; label: string; max: number }[] = [
    { key: "regularLimit", label: "Employee 401(k) limit", max: 100000 },
    { key: "totalLimit", label: "Total plan limit", max: 200000 },
    { key: "matchLimit", label: "Employer match cap", max: 50000 },
    { key: "afterTaxLimit", label: "Employer after-tax cap", max: 100000 },
    { key: "iraLimit", label: "Combined IRA limit", max: 30000 },
    { key: "hsaLimit", label: "Combined HSA limit", max: 20000 },
    { key: "employerHsa", label: "Employer HSA funding", max: 15000 },
    {
      key: "standardDeduction",
      label: "Federal standard deduction",
      max: 50000,
    },
    { key: "ssBase", label: "Social Security wage base", max: 400000 },
    {
      key: "esppFmvAllowance",
      label: "Remaining grant-FMV ESPP allowance",
      max: 25000,
    },
  ];
  const allocation = [
    {
      label: "Your invested / reserved savings",
      value: r.employeeSavings - r.heldEspp,
      color: "#0f6cbd",
    },
    { label: "Employer match + HSA", value: r.employer, color: "#5a78a6" },
    { label: "Retained RSUs, net vest tax", value: r.netRsu, color: "#67a383" },
    { label: "Retained ESPP, at cost", value: r.heldEspp, color: "#b89958" },
    { label: "Estimated taxes", value: r.totalTax.total, color: "#a5adb6" },
    {
      label: "Benefit / other deductions",
      value: r.s.preTaxBenefits + r.s.otherPayroll,
      color: "#b08783",
    },
    {
      label: "Available for living",
      value: Math.max(0, r.spendable),
      color: "#293e54",
    },
  ];
  return (
    <section aria-label="Savings planner">
      <div className="section-toolbar">
        <div>
          <h2>Yearly savings & take-home pay</h2>
          <p className="muted">
            Change the mix, not your real payroll elections.
          </p>
        </div>
        <TabList
          selectedValue={period}
          onTabSelect={(_, data) => {
            if (
              data.value === "annual" ||
              data.value === "monthly" ||
              data.value === "paycheck"
            )
              onPeriod(data.value);
          }}
          aria-label="Display period"
        >
          <Tab value="annual">Annual</Tab>
          <Tab value="monthly">Monthly</Tab>
          <Tab value="paycheck">Per paycheck</Tab>
        </TabList>
      </div>
      <div className="metrics three">
        <Metric
          label="Bank cash after payroll"
          value={periodMoney(r.payroll)}
          detail="Before IRA, brokerage, and cash-reserve additions."
        />
        <Metric
          label="Available for living"
          value={periodMoney(r.spendable)}
          tone={r.spendable < 0 ? "danger" : "accent"}
          detail="After selected savings and ESPP sales; before expenses."
        />
        <Metric
          label="Total retained savings"
          value={percent(r.totalRate)}
          detail={`${periodMoney(r.totalSavings)}; includes employer funding and retained RSUs. Employee-only rate: ${percent(r.employeeRate)} of cash pay.`}
        />
      </div>
      <MessageBar intent="warning">
        <MessageBarBody>
          {r.s.year === 2027
            ? "2027 contribution caps are editable 3%-rounded estimates, not official limits. Federal brackets and Social Security use 2026 references."
            : "2026 is a reference full-year scenario, not an exact filing or withholding forecast."}{" "}
          Amounts shown per month/check are annual averages; bonus and periodic
          share-sale cash flows are smoothed. A paycheck view uses 24
          semimonthly periods.
        </MessageBarBody>
      </MessageBar>
      <div className="two-column">
        <div className="panel">
          <div className="panel-heading">
            <h3>Contribution sliders</h3>
            <span className="muted">Annual $ unless marked %</span>
          </div>
          <div className="button-row">
            <Button onClick={() => onPreset("core")}>Core plan</Button>
            <Button onClick={() => onPreset("maximum")}>
              Max tax-advantaged
            </Button>
            <Button onClick={() => onPreset("cash")}>More cash</Button>
          </div>
          {controls.map(({ key, ...control }) => (
            <NumberControl
              key={key}
              {...control}
              value={r.s[key]}
              onChange={(value) => onChange({ [key]: value })}
              slider
            />
          ))}
        </div>
        <div className="panel-stack">
          <div className="panel">
            <h3>Annual compensation allocation</h3>
            <AllocationChart allocations={allocation} />
            <p className="muted">
              {money(r.gross)} gross compensation + {money(r.employer)} employer
              funding. Held ESPP is valued at cost; unvested stock is not a
              current asset.
            </p>
            {r.shortfall > 0 && (
              <MessageBar intent="error">
                <MessageBarBody>
                  {money(r.shortfall)} of this allocation is unfunded before
                  living expenses. The chart is not an achievable plan without
                  more cash.
                </MessageBarBody>
              </MessageBar>
            )}
          </div>
          <div className="panel">
            <h3>Cash-flow breakdown</h3>
            <dl className="money-list">
              <div>
                <dt>Salary + assumed bonus</dt>
                <dd>{periodMoney(r.cash)}</dd>
              </div>
              <div>
                <dt>Estimated tax on cash compensation</dt>
                <dd>-{periodMoney(r.baseTax.total)}</dd>
              </div>
              <div>
                <dt>Payroll savings + benefit deductions</dt>
                <dd>-{periodMoney(r.cash - r.baseTax.total - r.payroll)}</dd>
              </div>
              <div className="total">
                <dt>Bank cash after payroll</dt>
                <dd>{periodMoney(r.payroll)}</dd>
              </div>
              <div>
                <dt>IRA + brokerage + cash reserves</dt>
                <dd>-{periodMoney(r.outsidePayroll)}</dd>
              </div>
              <div>
                <dt>Net proceeds from selected ESPP sales</dt>
                <dd>+{periodMoney(r.saleProceeds)}</dd>
              </div>
              <div className="total">
                <dt>Available for living</dt>
                <dd>{periodMoney(r.spendable)}</dd>
              </div>
            </dl>
            <p className="muted">
              Holding all ESPP shares: {periodMoney(r.holdCash)}. Selling all
              purchases: {periodMoney(r.fullSaleCash)}, including about{" "}
              {money(r.fullSaleProceeds / 4)} per quarter, not a monthly
              deposit.
            </p>
          </div>
          <div className="panel">
            <h3>Checks before changing elections</h3>
            <ul className="plain-list">
              <li>
                Backdoor Roth:{" "}
                {r.s.iraStatus === "none"
                  ? "you marked no pre-tax IRA balances."
                  : "pre-tax Traditional / SEP / SIMPLE IRA balances still need attention; conversion tax is not estimated."}
              </li>
              <li>
                Mega Backdoor:{" "}
                {r.s.autoConvert
                  ? "automatic conversion marked enabled."
                  : "daily Roth conversion is not confirmed. After-tax contributions alone are not Roth assets."}
              </li>
              <li>
                HSA: assumes full-year self-only eligibility. Partial-year
                contribution rules are not determined by this calculator.
              </li>
              <li>
                RSUs: {exactMoney(r.s.rsu)} estimated gross in {r.s.year}, with{" "}
                {money(r.rsuTax)} reserved for estimated vest taxes.
              </li>
            </ul>
          </div>
          <details className="panel">
            <summary>Estimated annual taxes</summary>
            <dl className="money-list">
              {Object.entries(r.totalTax).map(([key, value]) => (
                <div key={key} className={key === "total" ? "total" : ""}>
                  <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd>{money(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              Estimated current tax reduction from employee pre-tax 401(k)/HSA:{" "}
              {money(r.taxSaved)}. This is estimated liability, not a payroll
              withholding forecast. Brokerage returns, conversion taxes and
              unobserved state payroll deductions are not modeled.
            </p>
          </details>
        </div>
      </div>
      <details className="panel">
        <summary>Compensation, tax assumptions & profile notes</summary>
        <div className="field-grid">
          <Field
            label={{ children: "Rule reference year", htmlFor: `${id}-year` }}
          >
            <Select
              id={`${id}-year`}
              value={String(r.s.year)}
              onChange={(_, data) => onYearChange(Number(data.value))}
            >
              <option value="2027">2027 estimates</option>
              <option value="2026">2026 full-year reference</option>
            </Select>
          </Field>
          {compensation.map(({ key, ...field }) => (
            <NumberControl
              key={key}
              {...field}
              step={field.suffix === "%" ? 0.1 : 1}
              value={r.s[key]}
              onChange={(value) => onChange({ [key]: value })}
            />
          ))}
        </div>
        <div className="check-row">
          <Checkbox
            label="Full-year self-only HSA eligibility"
            checked={r.s.hsaEligible}
            onChange={(_, data) =>
              onChange({ hsaEligible: data.checked === true })
            }
          />
          <Checkbox
            label="Daily automatic Roth conversion enabled"
            checked={r.s.autoConvert}
            onChange={(_, data) =>
              onChange({ autoConvert: data.checked === true })
            }
          />
          <Field
            label={{ children: "Pre-tax IRA balances", htmlFor: `${id}-ira` }}
          >
            <Select
              id={`${id}-ira`}
              value={r.s.iraStatus}
              onChange={(_, data) => {
                if (
                  data.value === "unknown" ||
                  data.value === "none" ||
                  data.value === "present"
                )
                  onChange({ iraStatus: data.value });
              }}
            >
              <option value="unknown">Not checked</option>
              <option value="none">None expected at year-end</option>
              <option value="present">Pre-tax balances exist</option>
            </Select>
          </Field>
        </div>
        <h4>Editable rule assumptions</h4>
        <div className="field-grid">
          {ruleFields.map(({ key, ...field }) => (
            <NumberControl
              key={key}
              {...field}
              value={r.s[key]}
              onChange={(value) => onChange({ [key]: value })}
            />
          ))}
          <NumberControl
            label="ESPP purchase FMV / grant FMV"
            min={0.1}
            max={5}
            step={0.01}
            suffix="x"
            value={r.s.esppPriceRatio}
            onChange={(value) => onChange({ esppPriceRatio: value })}
          />
        </div>
        <p className="muted">
          Provisional 2027 caps use 3% growth rounded to $500 (employee
          401(k)/IRA) and $1,000 (total plan). The projected match and after-tax
          cap assume unchanged employer-plan mechanics. HSA uses $4,500 with
          $1,000 assumed employer funding. Overrides are scenarios, not proof of
          legal contribution room.
        </p>
        <h4>Profile notes</h4>
        <ul className="plain-list">
          {profile.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="muted">
          Sources: local profile inputs and any supplied planning documents.
          Profile start date: {profile.startDate}; award approval:{" "}
          {profile.awardApprovalDate}; latest paystub on file:{" "}
          {profile.latestPaystub}. Vest dates: {award.vestDates.join(", ")}.
          Actual share rounding may differ.
        </p>
        <a
          href="https://www.fidelity.com/learning-center/smart-money/401k-contribution-limits"
          target="_blank"
          rel="noreferrer"
        >
          Fidelity: contribution-limit explanations
        </a>
      </details>
    </section>
  );
}

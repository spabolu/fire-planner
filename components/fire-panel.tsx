"use client";

import {
  Checkbox,
  MessageBar,
  MessageBarBody,
  ProgressBar,
} from "@fluentui/react-components";
import { ProjectionChart } from "@/components/charts";
import { Metric, NumberControl } from "@/components/controls";
import type { accountTotals } from "@/lib/accounts";
import type { buildFirePlan } from "@/lib/fire";
import { money, percent } from "@/lib/format";
import type { FireInputs } from "@/lib/types";

type NumericKey = {
  [K in keyof FireInputs]: FireInputs[K] extends number ? K : never;
}[keyof FireInputs];
type FireResult = ReturnType<typeof buildFirePlan>;
interface Props {
  inputs: FireInputs;
  result: FireResult;
  accounts: ReturnType<typeof accountTotals>;
  monthlyCushion: number;
  annualInvestment: number;
  partTimeNet: number;
  onChange: (patch: Partial<FireInputs>) => void;
}
export function FirePanel({
  inputs: f,
  result,
  accounts,
  monthlyCushion,
  annualInvestment,
  partTimeNet,
  onChange,
}: Props) {
  const regular = result.targets.find((target) => target.id === "fire");
  const expenses: { key: NumericKey; label: string; hint?: string }[] = [
    { key: "housing", label: "Housing", hint: "Your supplied estimate." },
    {
      key: "food",
      label: "Take-out + groceries",
      hint: "Your supplied estimate.",
    },
    { key: "utilities", label: "Utilities + internet" },
    { key: "transport", label: "Transport + insurance" },
    {
      key: "healthcare",
      label: "Healthcare after employment",
      hint: "Not assumed to remain employer-paid.",
    },
    { key: "other", label: "Other essentials" },
    {
      key: "taxBuffer",
      label: "Retirement withdrawal tax buffer",
      hint: "An expense allowance, not a tax simulation.",
    },
    { key: "regularExtra", label: "Regular FIRE: extra per month" },
    { key: "fatExtra", label: "FatFIRE: extra above regular" },
  ];
  return (
    <section aria-label="Financial independence">
      <div className="section-toolbar">
        <div>
          <h2>Your paths to financial independence</h2>
          <p className="muted">
            All targets and projections are in today&apos;s dollars. Change
            spending before assuming higher returns.
          </p>
        </div>
      </div>
      <div className="metrics three">
        <Metric
          label="FIRE starting portfolio"
          value={money(accounts.startingPortfolio)}
          detail={
            f.reserveDebt
              ? `${money(accounts.investments)} investments less ${money(accounts.debtReserve)} reserved for debts.`
              : "Gross selected investments. Debts are not reserved in this scenario."
          }
        />
        <Metric
          label="Recurring annual investment"
          value={money(annualInvestment)}
          detail="Linked to the savings planner. Cash-reserve additions are excluded; dated RSU vests are added separately."
        />
        <Metric
          label="Regular FIRE projected age"
          value={
            regular?.firstAge === null || regular?.firstAge === undefined
              ? "Beyond horizon"
              : String(regular.firstAge)
          }
          tone={monthlyCushion < 0 ? "danger" : "accent"}
          detail={`Desired checkpoint: ${f.targetAge}. A scenario result, not a forecast or guarantee.`}
        />
      </div>
      {monthlyCushion < 0 && (
        <MessageBar intent="error">
          <MessageBarBody>
            This contribution mix is short by {money(-monthlyCushion)}/month
            after estimated regular spending and known loan minimums. The
            displayed path assumes funding you do not currently have. Reduce
            contributions or expenses before relying on its dates.
          </MessageBarBody>
        </MessageBar>
      )}
      {!f.reserveDebt && (
        <MessageBar intent="warning">
          <MessageBarBody>
            Debt reservation is off. Targets currently count investments without
            subtracting {money(accounts.liabilities)} of liabilities. Debt
            service and payoff still need a separate plan.
          </MessageBarBody>
        </MessageBar>
      )}
      <div className="fire-targets">
        {result.targets.map((target) => {
          const progress =
            target.requiredPortfolio === 0
              ? 1
              : accounts.startingPortfolio / target.requiredPortfolio;
          return (
            <article className="panel fire-target" key={target.id}>
              <h3>{target.name}</h3>
              <strong className="target-number">
                {money(target.requiredPortfolio)}
              </strong>
              <p>
                {target.id === "coast"
                  ? `Growth-only target for retirement at ${f.coastRetirementAge}`
                  : `${money(target.annualSpending / 12)}/month ${target.id === "barista" ? "portfolio-funded gap" : "spending basis"}`}
              </p>
              <ProgressBar
                value={Math.max(0, Math.min(1, progress))}
                aria-label={`${target.name} progress`}
              />
              <div className="target-progress">
                <span>{percent(progress)} funded</span>
                <strong>
                  {target.firstAge === null
                    ? "Not reached by 100"
                    : `Age ${target.firstAge}`}
                </strong>
              </div>
              <p className="muted">{target.description}</p>
            </article>
          );
        })}
      </div>
      <div className="panel">
        <h3>Progress over time</h3>
        <ProjectionChart
          points={result.points}
          target={regular?.requiredPortfolio ?? 0}
          targetAge={f.targetAge}
        />
      </div>
      <div className="two-column">
        <div className="panel">
          <h3>What would it take by your target age?</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Age</th>
                  <th>Projected investments</th>
                  <th>Gap to regular FIRE</th>
                  <th>Required annual investment</th>
                </tr>
              </thead>
              <tbody>
                {result.milestones.map((point) => (
                  <tr key={point.age}>
                    <th scope="row">{point.age}</th>
                    <td>{money(point.portfolio)}</td>
                    <td>{money(point.gapToFire)}</td>
                    <td>
                      {point.requiredAnnualInvestment === null
                        ? "Not achievable at this date"
                        : money(point.requiredAnnualInvestment)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Required annual investment is total recurring investment, not an
            extra amount on top of the planner. Dated stock vests are accounted
            for once. Higher required contributions may exceed your earnings and
            available tax-advantaged space.
          </p>
        </div>
        <div className="panel">
          <h3>Cash buffer & early-access bridge</h3>
          <dl className="money-list">
            <div>
              <dt>Emergency reserve target</dt>
              <dd>{money(result.leanMonthly * f.emergencyMonths)}</dd>
            </div>
            <div>
              <dt>Emergency cash you designated</dt>
              <dd>{money(f.emergencyCash)}</dd>
            </div>
            <div>
              <dt>Emergency reserve gap</dt>
              <dd>
                {money(
                  Math.max(
                    0,
                    result.leanMonthly * f.emergencyMonths - f.emergencyCash,
                  ),
                )}
              </dd>
            </div>
            <div>
              <dt>Taxable investments</dt>
              <dd>{money(accounts.accessible)}</dd>
            </div>
            <div>
              <dt>Taxable assets after all debt reserves</dt>
              <dd>{money(accounts.accessibleAfterDebt)}</dd>
            </div>
            <div>
              <dt>Retirement / included HSA assets</dt>
              <dd>{money(accounts.restricted)}</dd>
            </div>
          </dl>
          <p className="muted">
            Checking balances are not automatically emergency funds. Roth
            contribution basis and early-access strategies are unknown, so
            retirement accounts are not counted as an immediately accessible
            bridge. No bridge-withdrawal strategy is assumed.
          </p>
        </div>
      </div>
      <div className="panel">
        <h3>Spending assumptions: monthly, today&apos;s dollars</h3>
        <p className="muted">
          Only housing and food came from your estimate. All other fields are
          editable placeholders. Lean = essentials; regular = Lean + regular
          extra; Fat = regular + Fat extra. Debt is reserved from starting
          assets separately, not capitalized into retirement spending twice.
        </p>
        <div className="field-grid">
          {expenses.map(({ key, ...field }) => (
            <NumberControl
              key={key}
              {...field}
              value={f[key]}
              max={30000}
              step={50}
              onChange={(value) => onChange({ [key]: value })}
            />
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>Timeline, returns & part-time assumptions</h3>
        <div className="field-grid">
          <NumberControl
            label="Current age"
            value={f.currentAge}
            min={18}
            max={90}
            step={1}
            suffix="years"
            onChange={(value) => onChange({ currentAge: Math.round(value) })}
          />
          <NumberControl
            label="Desired full-FIRE age"
            value={f.targetAge}
            min={f.currentAge}
            max={100}
            step={1}
            suffix="years"
            onChange={(value) => onChange({ targetAge: Math.round(value) })}
          />
          <NumberControl
            label="CoastFIRE retirement age"
            value={f.coastRetirementAge}
            min={f.currentAge}
            max={100}
            step={1}
            suffix="years"
            onChange={(value) =>
              onChange({ coastRetirementAge: Math.round(value) })
            }
          />
          <NumberControl
            label="Real annual investment return"
            value={f.realReturn}
            min={-10}
            max={12}
            step={0.25}
            suffix="%"
            hint="After inflation and fees. Constant-return assumption, not a guarantee."
            onChange={(value) => onChange({ realReturn: value })}
            slider
          />
          <NumberControl
            label="Withdrawal rate"
            value={f.withdrawalRate}
            min={1}
            max={6}
            step={0.1}
            suffix="%"
            hint="Lower rates raise the target. Does not guarantee safety for a 50+ year retirement."
            onChange={(value) => onChange({ withdrawalRate: value })}
            slider
          />
          <NumberControl
            label="Part-time hourly wage (gross)"
            value={f.partTimeHourly}
            max={150}
            step={1}
            hint="$35 is a planning proxy, not a verified Seattle part-time median."
            onChange={(value) => onChange({ partTimeHourly: value })}
          />
          <NumberControl
            label="Part-time hours per week"
            value={f.partTimeHours}
            max={60}
            step={1}
            suffix="hours"
            onChange={(value) => onChange({ partTimeHours: value })}
          />
          <NumberControl
            label="Part-time weeks per year"
            value={f.partTimeWeeks}
            max={52}
            step={1}
            suffix="weeks"
            onChange={(value) => onChange({ partTimeWeeks: value })}
          />
          <NumberControl
            label="Emergency reserve months"
            value={f.emergencyMonths}
            max={24}
            step={1}
            suffix="months"
            onChange={(value) => onChange({ emergencyMonths: value })}
          />
          <NumberControl
            label="Designated emergency cash"
            value={f.emergencyCash}
            max={1000000}
            step={100}
            hint="Not inferred from account balances. Enter the cash actually set aside for emergencies."
            onChange={(value) => onChange({ emergencyCash: value })}
          />
        </div>
        <div className="check-row">
          <Checkbox
            label="Reserve all liabilities from FIRE starting assets"
            checked={f.reserveDebt}
            onChange={(_, data) =>
              onChange({ reserveDebt: data.checked === true })
            }
          />
          <Checkbox
            label="Include HSA assets / contributions in FI portfolio"
            checked={f.includeHsa}
            onChange={(_, data) =>
              onChange({ includeHsa: data.checked === true })
            }
          />
        </div>
        <p className="muted">
          Part-time estimate:{" "}
          {money(f.partTimeHourly * f.partTimeHours * f.partTimeWeeks)} gross,
          about {money(partTimeNet / 12)}/month net using wage-only tax
          estimates. Retirement withdrawals could change total tax; use the
          spending tax buffer. BaristaFIRE assumes this income continues, not
          that all paid work ends. Healthcare is budgeted separately.
        </p>
        <p className="muted">
          The debt reserve is a conservative one-time deduction, not a simulated
          sale or debt amortization. Cash, vehicles, other non-investment
          assets, and unvested awards are excluded from FIRE capital. No future
          refresh grants, raises, Social Security benefits, or investment
          appreciation outside the selected return assumption are promised.
        </p>
      </div>
    </section>
  );
}

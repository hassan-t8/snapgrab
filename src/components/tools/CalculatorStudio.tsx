"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";

/* ------------------------------------------------------------------ *
 * shared helpers
 * ------------------------------------------------------------------ */

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";

/** Parse a user-typed amount; commas and spaces are allowed ("1,20,000"). */
function num(value: string): number {
  const n = Number(value.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;

function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Records one anonymous use per page view, once the calculator produces a real result. */
function useTrackOnce(slug: string, ready: boolean) {
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    fetch("/api/tools/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ tool: slug, files: 1 }),
    }).catch(() => {});
  }, [slug, ready]);
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <input
        type={type}
        inputMode={type === "text" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={field}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${strong ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white" : "surface"}`}>
      <span className={`block text-xs font-bold uppercase tracking-wider ${strong ? "text-white/80" : "text-muted"}`}>
        {label}
      </span>
      <span className="mt-1 block break-words text-xl font-extrabold sm:text-2xl">{value}</span>
    </div>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
            value === o.value
              ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
              : "surface text-muted hover:text-[var(--fg)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pakistan salaried income tax — tax year 2026-27
 * ------------------------------------------------------------------ */

const PK_SLABS_2026_27 = [
  { from: 0, to: 600_000, base: 0, rate: 0 },
  { from: 600_000, to: 1_200_000, base: 0, rate: 0.01 },
  { from: 1_200_000, to: 2_200_000, base: 6_000, rate: 0.11 },
  { from: 2_200_000, to: 3_200_000, base: 116_000, rate: 0.2 },
  { from: 3_200_000, to: 4_100_000, base: 316_000, rate: 0.25 },
  { from: 4_100_000, to: 5_600_000, base: 541_000, rate: 0.29 },
  { from: 5_600_000, to: 7_000_000, base: 976_000, rate: 0.32 },
  { from: 7_000_000, to: Infinity, base: 1_424_000, rate: 0.35 },
];

function pkSalaryTax(yearly: number) {
  const slab = PK_SLABS_2026_27.find((s) => yearly <= s.to) ?? PK_SLABS_2026_27[PK_SLABS_2026_27.length - 1];
  const tax = yearly <= 0 ? 0 : slab.base + (yearly - slab.from) * slab.rate;
  return { tax, slab };
}

function IncomeTaxPk({ slug }: { slug: string }) {
  const [salary, setSalary] = useState("150000");
  const [period, setPeriod] = useState<"month" | "year">("month");

  const yearly = num(salary) * (period === "month" ? 12 : 1);
  const { tax, slab } = pkSalaryTax(yearly);
  useTrackOnce(slug, yearly > 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Gross salary (Rs)" value={salary} onChange={setSalary} placeholder="150000" />
        <Toggle
          value={period}
          onChange={setPeriod}
          options={[
            { value: "month", label: "Monthly" },
            { value: "year", label: "Yearly" },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Monthly tax" value={rs(tax / 12)} strong />
        <Stat label="Monthly take-home" value={rs((yearly - tax) / 12)} />
        <Stat label="Yearly tax" value={rs(tax)} />
        <Stat label="Effective tax rate" value={`${fmt(yearly ? (tax / yearly) * 100 : 0)}%`} />
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Yearly income</th>
              <th className="px-4 py-3">Tax</th>
            </tr>
          </thead>
          <tbody>
            {PK_SLABS_2026_27.map((s) => {
              const active = s === slab && yearly > 0;
              return (
                <tr key={s.from} className={active ? "bg-brand-500/15 font-bold" : ""}>
                  <td className="px-3 py-2.5 sm:px-4">
                    {s.to === Infinity ? (
                      `Above ${rs(s.from)}`
                    ) : (
                      <>
                        <span className="whitespace-nowrap">{rs(s.from + (s.from ? 1 : 0))}</span> –{" "}
                        <span className="whitespace-nowrap">{rs(s.to)}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    {/* round: 0.29 * 100 is 28.999… in floating point */}
                    {s.rate === 0
                      ? "0%"
                      : `${s.base ? `${rs(s.base)} + ` : ""}${Math.round(s.rate * 100)}% above ${rs(s.from)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Salaried slabs for tax year 2026-27 (July 2026 – June 2027). An estimate only — confirm with the latest FBR
        notification. Tax credits, exemptions and surcharges are not included.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Zakat
 * ------------------------------------------------------------------ */

const NISAB_TOLA = { silver: 52.5, gold: 7.5 } as const;

function Zakat({ slug }: { slug: string }) {
  const [basis, setBasis] = useState<"silver" | "gold">("silver");
  const [price, setPrice] = useState("");
  const [v, setV] = useState({ cash: "", bank: "", gold: "", silver: "", business: "", owed: "", investments: "", debts: "" });
  const set = (k: keyof typeof v) => (value: string) => setV((p) => ({ ...p, [k]: value }));

  const assets = num(v.cash) + num(v.bank) + num(v.gold) + num(v.silver) + num(v.business) + num(v.owed) + num(v.investments);
  const net = Math.max(0, assets - num(v.debts));
  const nisab = num(price) * NISAB_TOLA[basis];
  const due = nisab > 0 && net >= nisab ? net * 0.025 : 0;
  useTrackOnce(slug, assets > 0 && nisab > 0);

  return (
    <>
      <div className="rounded-2xl surface p-4">
        <span className="mb-2 block text-sm font-semibold">Nisab based on</span>
        <Toggle
          value={basis}
          onChange={setBasis}
          options={[
            { value: "silver", label: "Silver (52.5 tola)" },
            { value: "gold", label: "Gold (7.5 tola)" },
          ]}
        />
        <div className="mt-3">
          <Field
            label={`Today's ${basis} price per tola (Rs)`}
            value={price}
            onChange={setPrice}
            placeholder={basis === "silver" ? "e.g. 4500" : "e.g. 400000"}
            hint="Check today's rate from your local sarafa market — prices change daily."
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Cash in hand (Rs)" value={v.cash} onChange={set("cash")} placeholder="0" />
        <Field label="Bank balances (Rs)" value={v.bank} onChange={set("bank")} placeholder="0" />
        <Field label="Value of gold (Rs)" value={v.gold} onChange={set("gold")} placeholder="0" />
        <Field label="Value of silver (Rs)" value={v.silver} onChange={set("silver")} placeholder="0" />
        <Field label="Business stock / trade goods (Rs)" value={v.business} onChange={set("business")} placeholder="0" />
        <Field label="Money owed to you (Rs)" value={v.owed} onChange={set("owed")} placeholder="0" />
        <Field label="Investments & shares (Rs)" value={v.investments} onChange={set("investments")} placeholder="0" />
        <Field label="Debts & bills due now (Rs)" value={v.debts} onChange={set("debts")} placeholder="0" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Zakat due" value={rs(due)} strong />
        <Stat label="Net zakatable wealth" value={rs(net)} />
        <Stat label="Nisab" value={nisab ? rs(nisab) : "Enter price"} />
      </div>
      <p className="mt-3 text-sm text-muted">
        {!nisab
          ? "Enter today's silver or gold price to work out the Nisab."
          : net >= nisab
            ? "Your wealth is at or above the Nisab, so Zakat (2.5%) is due once it has been held for a full lunar year."
            : "Your wealth is below the Nisab, so no Zakat is due."}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Loan EMI
 * ------------------------------------------------------------------ */

function Emi({ slug }: { slug: string }) {
  const [amount, setAmount] = useState("2000000");
  const [rate, setRate] = useState("18");
  const [tenure, setTenure] = useState("5");
  const [unit, setUnit] = useState<"years" | "months">("years");

  const P = num(amount);
  const n = Math.round(num(tenure) * (unit === "years" ? 12 : 1));
  const r = num(rate) / 1200;
  const emi = n > 0 ? (r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) : 0;
  const total = emi * n;
  useTrackOnce(slug, P > 0 && n > 0);

  const schedule = useMemo(() => {
    const rows: { year: number; principal: number; interest: number; balance: number }[] = [];
    let balance = P;
    for (let m = 1; m <= n && n <= 600; m++) {
      const interest = balance * r;
      const principal = emi - interest;
      balance = Math.max(0, balance - principal);
      const year = Math.ceil(m / 12);
      const row = rows[year - 1] ?? (rows[year - 1] = { year, principal: 0, interest: 0, balance: 0 });
      row.principal += principal;
      row.interest += interest;
      row.balance = balance;
    }
    return rows;
  }, [P, n, r, emi]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Loan amount (Rs)" value={amount} onChange={setAmount} placeholder="2000000" />
        <Field label="Interest rate (% per year)" value={rate} onChange={setRate} placeholder="18" />
        <Field label="Loan period" value={tenure} onChange={setTenure} placeholder="5" />
        <div className="self-end">
          <Toggle
            value={unit}
            onChange={setUnit}
            options={[
              { value: "years", label: "Years" },
              { value: "months", label: "Months" },
            ]}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Monthly installment" value={rs(emi)} strong />
        <Stat label="Total interest" value={rs(Math.max(0, total - P))} />
        <Stat label="Total payment" value={rs(total)} />
      </div>

      {schedule.length > 0 && (
        <div className="mt-5 max-h-80 overflow-auto rounded-2xl surface">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--bg-soft)]">
              <tr className="text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Principal paid</th>
                <th className="px-4 py-3">Interest paid</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.year}>
                  <td className="px-4 py-2">{row.year}</td>
                  <td className="px-4 py-2">{rs(row.principal)}</td>
                  <td className="px-4 py-2">{rs(row.interest)}</td>
                  <td className="px-4 py-2">{rs(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * GPA / CGPA (4.0 scale)
 * ------------------------------------------------------------------ */

const GRADES: { label: string; gp: number }[] = [
  { label: "A", gp: 4 },
  { label: "A−", gp: 3.67 },
  { label: "B+", gp: 3.33 },
  { label: "B", gp: 3 },
  { label: "B−", gp: 2.67 },
  { label: "C+", gp: 2.33 },
  { label: "C", gp: 2 },
  { label: "C−", gp: 1.67 },
  { label: "D+", gp: 1.33 },
  { label: "D", gp: 1 },
  { label: "F", gp: 0 },
];

let rowId = 0;
const newCourse = () => ({ id: rowId++, credits: "3", gp: "4" });
const newSemester = () => ({ id: rowId++, gpa: "", credits: "" });

function Cgpa({ slug }: { slug: string }) {
  const [courses, setCourses] = useState(() => Array.from({ length: 5 }, newCourse));
  const [semesters, setSemesters] = useState(() => [newSemester()]);

  const cur = courses.reduce(
    (acc, c) => ({ points: acc.points + num(c.credits) * num(c.gp), credits: acc.credits + num(c.credits) }),
    { points: 0, credits: 0 },
  );
  const gpa = cur.credits ? cur.points / cur.credits : 0;
  const past = semesters.reduce(
    (acc, s) => ({ points: acc.points + num(s.gpa) * num(s.credits), credits: acc.credits + num(s.credits) }),
    { points: 0, credits: 0 },
  );
  const totalCredits = cur.credits + past.credits;
  const cgpa = totalCredits ? (cur.points + past.points) / totalCredits : 0;
  useTrackOnce(slug, cur.credits > 0);

  return (
    <>
      <span className="mb-2 block text-sm font-semibold">This semester&apos;s courses</span>
      <div className="space-y-2">
        {courses.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-xs font-bold text-muted">#{i + 1}</span>
            <input
              inputMode="decimal"
              value={c.credits}
              onChange={(e) => setCourses((p) => p.map((x) => (x.id === c.id ? { ...x, credits: e.target.value } : x)))}
              aria-label={`Course ${i + 1} credit hours`}
              placeholder="Credits"
              className={`${field} w-24`}
            />
            <select
              value={GRADES.find((g) => String(g.gp) === c.gp)?.gp ?? ""}
              onChange={(e) => setCourses((p) => p.map((x) => (x.id === c.id ? { ...x, gp: e.target.value } : x)))}
              aria-label={`Course ${i + 1} grade`}
              className={`${field} w-28`}
            >
              <option value="">Grade</option>
              {GRADES.map((g) => (
                <option key={g.label} value={g.gp}>
                  {g.label} ({g.gp})
                </option>
              ))}
            </select>
            <input
              inputMode="decimal"
              value={c.gp}
              onChange={(e) => setCourses((p) => p.map((x) => (x.id === c.id ? { ...x, gp: e.target.value } : x)))}
              aria-label={`Course ${i + 1} grade points`}
              placeholder="Points"
              className={`${field} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => setCourses((p) => p.filter((x) => x.id !== c.id))}
              aria-label={`Remove course ${i + 1}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl surface text-muted hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setCourses((p) => [...p, newCourse()])}
        className="mt-3 flex items-center gap-2 rounded-xl surface px-4 py-2 text-sm font-bold hover:border-brand-400/60"
      >
        <Plus className="h-4 w-4" /> Add course
      </button>

      <span className="mb-2 mt-6 block text-sm font-semibold">Previous semesters (optional)</span>
      <div className="space-y-2">
        {semesters.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-xs font-bold text-muted">S{i + 1}</span>
            <input
              inputMode="decimal"
              value={s.gpa}
              onChange={(e) => setSemesters((p) => p.map((x) => (x.id === s.id ? { ...x, gpa: e.target.value } : x)))}
              aria-label={`Semester ${i + 1} GPA`}
              placeholder="GPA e.g. 3.4"
              className={`${field} min-w-0 flex-1`}
            />
            <input
              inputMode="decimal"
              value={s.credits}
              onChange={(e) => setSemesters((p) => p.map((x) => (x.id === s.id ? { ...x, credits: e.target.value } : x)))}
              aria-label={`Semester ${i + 1} credit hours`}
              placeholder="Credit hours"
              className={`${field} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => setSemesters((p) => p.filter((x) => x.id !== s.id))}
              aria-label={`Remove semester ${i + 1}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl surface text-muted hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setSemesters((p) => [...p, newSemester()])}
        className="mt-3 flex items-center gap-2 rounded-xl surface px-4 py-2 text-sm font-bold hover:border-brand-400/60"
      >
        <Plus className="h-4 w-4" /> Add semester
      </button>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Semester GPA" value={fmt(gpa)} strong />
        <Stat label="Cumulative CGPA" value={fmt(cgpa)} />
        <Stat label="Total credit hours" value={fmt(totalCredits, 1)} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Age
 * ------------------------------------------------------------------ */

function toInputDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function Age({ slug }: { slug: string }) {
  const [dob, setDob] = useState("2000-01-01");
  const [asOf, setAsOf] = useState("");
  // set "today" on the client only, so server and client render the same markup
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAsOf((prev) => prev || toInputDate(new Date())));
    return () => cancelAnimationFrame(raf);
  }, []);

  const result = useMemo(() => {
    const from = parseDate(dob);
    const to = parseDate(asOf);
    if (!from || !to || to < from) return null;
    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    let days = to.getDate() - from.getDate();
    if (days < 0) {
      months -= 1;
      days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    let next = new Date(to.getFullYear(), from.getMonth(), from.getDate());
    if (next <= to) next = new Date(to.getFullYear() + 1, from.getMonth(), from.getDate());
    const untilBirthday = Math.round((next.getTime() - to.getTime()) / 86_400_000);
    return { years, months, days, totalDays, totalMonths: years * 12 + months, untilBirthday };
  }, [dob, asOf]);
  useTrackOnce(slug, result !== null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date of birth" type="date" value={dob} onChange={setDob} />
        <Field label="Age on (date)" type="date" value={asOf} onChange={setAsOf} hint="Use a job ad's closing date to check eligibility." />
      </div>
      {result ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Stat label="Exact age" value={`${result.years} years, ${result.months} months, ${result.days} days`} strong />
          </div>
          <Stat label="Total months" value={fmt(result.totalMonths, 0)} />
          <Stat label="Total days" value={fmt(result.totalDays, 0)} />
          <Stat label="Next birthday in" value={`${result.untilBirthday} days`} />
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">Pick a date of birth that is before the &quot;age on&quot; date.</p>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Percentage
 * ------------------------------------------------------------------ */

function Card({ title, children, result }: { title: string; children: ReactNode; result: string }) {
  return (
    <div className="rounded-2xl surface p-4">
      <span className="block text-sm font-bold">{title}</span>
      <div className="mt-3 grid grid-cols-2 gap-2">{children}</div>
      <span className="mt-3 block text-2xl font-extrabold text-brand-400">{result}</span>
    </div>
  );
}

function Percentage({ slug }: { slug: string }) {
  const [obtained, setObtained] = useState("850");
  const [total, setTotal] = useState("1100");
  const [pct, setPct] = useState("20");
  const [of, setOf] = useState("5000");
  const [part, setPart] = useState("45");
  const [whole, setWhole] = useState("60");
  const [from, setFrom] = useState("100000");
  const [to, setTo] = useState("120000");
  useTrackOnce(slug, true);

  const change = num(from) ? ((num(to) - num(from)) / num(from)) * 100 : NaN;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card title="Marks percentage" result={num(total) ? `${fmt((num(obtained) / num(total)) * 100)}%` : "—"}>
        <Field label="Obtained" value={obtained} onChange={setObtained} />
        <Field label="Total" value={total} onChange={setTotal} />
      </Card>
      <Card title="X% of Y" result={fmt((num(pct) / 100) * num(of))}>
        <Field label="Percent (%)" value={pct} onChange={setPct} />
        <Field label="Of number" value={of} onChange={setOf} />
      </Card>
      <Card title="X is what % of Y" result={num(whole) ? `${fmt((num(part) / num(whole)) * 100)}%` : "—"}>
        <Field label="Value (X)" value={part} onChange={setPart} />
        <Field label="Total (Y)" value={whole} onChange={setWhole} />
      </Card>
      <Card
        title="Percentage increase / decrease"
        result={Number.isFinite(change) ? `${change >= 0 ? "+" : ""}${fmt(change)}%` : "—"}
      >
        <Field label="From" value={from} onChange={setFrom} />
        <Field label="To" value={to} onChange={setTo} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * BMI
 * ------------------------------------------------------------------ */

function Bmi({ slug }: { slug: string }) {
  const [kg, setKg] = useState("70");
  const [hUnit, setHUnit] = useState<"ft" | "cm">("ft");
  const [cm, setCm] = useState("170");
  const [ft, setFt] = useState("5");
  const [inch, setInch] = useState("7");

  const meters = hUnit === "cm" ? num(cm) / 100 : (num(ft) * 12 + num(inch)) * 0.0254;
  const bmi = meters > 0 ? num(kg) / (meters * meters) : 0;
  const category =
    bmi <= 0 ? "—" : bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy weight" : bmi < 30 ? "Overweight" : "Obese";
  useTrackOnce(slug, bmi > 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Weight (kg)" value={kg} onChange={setKg} />
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Height</span>
          <Toggle
            value={hUnit}
            onChange={setHUnit}
            options={[
              { value: "ft", label: "Feet + inches" },
              { value: "cm", label: "Centimetres" },
            ]}
          />
        </div>
        {hUnit === "cm" ? (
          <Field label="Height (cm)" value={cm} onChange={setCm} />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <Field label="Feet" value={ft} onChange={setFt} />
            <Field label="Inches" value={inch} onChange={setInch} />
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Your BMI" value={bmi ? fmt(bmi, 1) : "—"} strong />
        <Stat label="Category" value={category} />
        <Stat
          label="Healthy weight"
          value={meters ? `${fmt(18.5 * meters * meters, 1)} – ${fmt(24.9 * meters * meters, 1)} kg` : "—"}
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        BMI is a screening number, not a diagnosis. For South Asian adults, health risks can begin around a BMI of 23.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Unit converter
 * ------------------------------------------------------------------ */

const SQFT = 0.09290304;
const UNITS: Record<string, { label: string; units: Record<string, { label: string; f: number }> }> = {
  length: {
    label: "Length",
    units: {
      mm: { label: "Millimetre", f: 0.001 },
      cm: { label: "Centimetre", f: 0.01 },
      m: { label: "Metre", f: 1 },
      km: { label: "Kilometre", f: 1000 },
      in: { label: "Inch", f: 0.0254 },
      ft: { label: "Foot", f: 0.3048 },
      yd: { label: "Yard", f: 0.9144 },
      mi: { label: "Mile", f: 1609.344 },
    },
  },
  weight: {
    label: "Weight",
    units: {
      mg: { label: "Milligram", f: 1e-6 },
      g: { label: "Gram", f: 0.001 },
      kg: { label: "Kilogram", f: 1 },
      t: { label: "Tonne", f: 1000 },
      oz: { label: "Ounce", f: 0.028349523125 },
      lb: { label: "Pound", f: 0.45359237 },
      tola: { label: "Tola", f: 0.0116638 },
      maund: { label: "Maund (40 kg)", f: 40 },
    },
  },
  area: {
    label: "Area",
    units: {
      sqft: { label: "Square foot", f: SQFT },
      sqyd: { label: "Square yard", f: 0.83612736 },
      sqm: { label: "Square metre", f: 1 },
      marla225: { label: "Marla (225 sq ft)", f: 225 * SQFT },
      marla272: { label: "Marla (272.25 sq ft)", f: 272.25 * SQFT },
      kanal225: { label: "Kanal (20 × 225 sq ft)", f: 4500 * SQFT },
      kanal272: { label: "Kanal (20 × 272.25 sq ft)", f: 5445 * SQFT },
      acre: { label: "Acre", f: 4046.8564224 },
      ha: { label: "Hectare", f: 10_000 },
      sqkm: { label: "Square kilometre", f: 1_000_000 },
    },
  },
  volume: {
    label: "Volume",
    units: {
      ml: { label: "Millilitre", f: 0.001 },
      l: { label: "Litre", f: 1 },
      m3: { label: "Cubic metre", f: 1000 },
      galus: { label: "Gallon (US)", f: 3.785411784 },
      galuk: { label: "Gallon (UK)", f: 4.54609 },
      cup: { label: "Cup (US)", f: 0.2365882365 },
      floz: { label: "Fluid ounce (US)", f: 0.0295735295625 },
    },
  },
  speed: {
    label: "Speed",
    units: {
      ms: { label: "Metres per second", f: 1 },
      kmh: { label: "Kilometres per hour", f: 1 / 3.6 },
      mph: { label: "Miles per hour", f: 0.44704 },
      kn: { label: "Knot", f: 1852 / 3600 },
    },
  },
  temperature: {
    label: "Temperature",
    units: {
      c: { label: "Celsius (°C)", f: 1 },
      f: { label: "Fahrenheit (°F)", f: 1 },
      k: { label: "Kelvin (K)", f: 1 },
    },
  },
};

function convertTemp(value: number, from: string, to: string) {
  const c = from === "c" ? value : from === "f" ? ((value - 32) * 5) / 9 : value - 273.15;
  return to === "c" ? c : to === "f" ? (c * 9) / 5 + 32 : c + 273.15;
}

function UnitConverter({ slug }: { slug: string }) {
  const [cat, setCat] = useState("area");
  const [from, setFrom] = useState("marla225");
  const [to, setTo] = useState("sqft");
  const [value, setValue] = useState("5");
  useTrackOnce(slug, true);

  const units = UNITS[cat].units;
  const convert = (v: number, a: string, b: string) =>
    cat === "temperature" ? convertTemp(v, a, b) : (v * units[a].f) / units[b].f;
  const result = units[from] && units[to] ? convert(num(value), from, to) : NaN;

  function pickCategory(next: string) {
    const keys = Object.keys(UNITS[next].units);
    setCat(next);
    setFrom(keys[0]);
    setTo(keys[1] ?? keys[0]);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {Object.entries(UNITS).map(([key, c]) => (
          <button
            key={key}
            type="button"
            onClick={() => pickCategory(key)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              cat === key
                ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25"
                : "surface text-muted hover:text-[var(--fg)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Value" value={value} onChange={setValue} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={field}>
            {Object.entries(units).map(([k, u]) => (
              <option key={k} value={k}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">To</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={field}>
            {Object.entries(units).map(([k, u]) => (
              <option key={k} value={k}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5">
        <Stat
          label="Result"
          value={`${fmt(num(value), 6)} ${units[from]?.label ?? ""} = ${fmt(result, 6)} ${units[to]?.label ?? ""}`}
          strong
        />
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">{fmt(num(value), 6)} {units[from]?.label} in</th>
              <th className="px-4 py-3">Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(units)
              .filter(([k]) => k !== from)
              .map(([k, u]) => (
                <tr key={k}>
                  <td className="px-4 py-2">{u.label}</td>
                  <td className="px-4 py-2 font-mono">{fmt(convert(num(value), from, k), 6)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Currency converter — daily rates from /api/rates (cached server side)
 * ------------------------------------------------------------------ */

type RatesPayload = { base: "USD"; updatedAt: string; nextUpdateAt: string | null; rates: Record<string, number> };

const POPULAR_CURRENCIES = ["PKR", "USD", "AED", "SAR", "GBP", "EUR", "CAD", "AUD", "QAR", "KWD", "OMR", "BHD", "MYR", "CNY", "INR", "TRY", "JPY"];

function currencyName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Currency({ slug }: { slug: string }) {
  const [data, setData] = useState<RatesPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("PKR");

  useEffect(() => {
    let alive = true;
    fetch("/api/rates")
      .then(async (r) => {
        const json = (await r.json().catch(() => null)) as { ok: boolean; data?: RatesPayload; stale?: boolean; error?: string } | null;
        if (!alive) return;
        if (!json?.ok || !json.data) {
          const msg = json?.error ?? "Could not load exchange rates. Please try again.";
          setError(msg);
          notify.error("Rates unavailable", msg);
          return;
        }
        setError(null);
        setData(json.data);
        setStale(!!json.stale);
      })
      .catch(() => {
        if (!alive) return;
        setError("You seem to be offline. Check your connection and try again.");
        notify.error("Network error", "Could not reach the server.");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const codes = useMemo(() => {
    if (!data) return POPULAR_CURRENCIES;
    const all = Object.keys(data.rates).sort();
    return [...POPULAR_CURRENCIES.filter((c) => data.rates[c]), ...all.filter((c) => !POPULAR_CURRENCIES.includes(c))];
  }, [data]);

  const value = num(amount);
  const rate = data && data.rates[from] && data.rates[to] ? data.rates[to] / data.rates[from] : 0;
  const result = value * rate;
  useTrackOnce(slug, rate > 0 && value > 0);

  if (error && !data) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
          className="mt-4 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading exchange rates">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl surface" />
          ))}
        </div>
        <div className="h-24 animate-pulse rounded-2xl surface" />
      </div>
    );
  }

  const select = (v: string, set: (v: string) => void, label: string) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <select value={v} onChange={(e) => set(e.target.value)} className={field}>
        {codes.map((c) => (
          <option key={c} value={c}>
            {c} — {currencyName(c)}
          </option>
        ))}
      </select>
    </label>
  );

  const updated = new Date(data.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end">
        <Field label="Amount" value={amount} onChange={setAmount} placeholder="100" />
        {select(from, setFrom, "From")}
        <button
          type="button"
          aria-label="Swap currencies"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="h-[42px] rounded-xl surface px-4 text-sm font-bold text-muted transition-colors hover:text-brand-400"
        >
          ⇄
        </button>
        {select(to, setTo, "To")}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat label={`${fmt(value)} ${from} =`} value={`${fmt(result, result < 1 ? 6 : 2)} ${to}`} strong />
        <Stat label="Rate" value={`1 ${from} = ${fmt(rate, 6)} ${to}`} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">
                {fmt(value)} {from} in
              </th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {POPULAR_CURRENCIES.filter((c) => c !== from && data.rates[c])
              .slice(0, 10)
              .map((c) => (
                <tr key={c} className="border-t border-[var(--line)]">
                  <td className="px-4 py-2.5">
                    <strong>{c}</strong> <span className="text-muted">{currencyName(c)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt((value * data.rates[c]) / data.rates[from])}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        {stale ? "Showing the last saved rates — live rates could not be refreshed just now. " : ""}
        Mid-market rates updated {updated}. Banks and exchange companies add their own margin.{" "}
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-400">
          Rates by Exchange Rate API
        </a>
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Prayer times + Qibla — calculated locally with adhan, no API
 * ------------------------------------------------------------------ */

type Place = { name: string; lat: number; lng: number; tz: string };

const PK = "Asia/Karachi";

const PLACES: { group: string; items: Place[] }[] = [
  {
    group: "Pakistan",
    items: [
      { name: "Karachi", lat: 24.8607, lng: 67.0011, tz: PK },
      { name: "Lahore", lat: 31.5204, lng: 74.3587, tz: PK },
      { name: "Islamabad", lat: 33.6844, lng: 73.0479, tz: PK },
      { name: "Rawalpindi", lat: 33.5651, lng: 73.0169, tz: PK },
      { name: "Faisalabad", lat: 31.4504, lng: 73.135, tz: PK },
      { name: "Multan", lat: 30.1575, lng: 71.5249, tz: PK },
      { name: "Peshawar", lat: 34.0151, lng: 71.5249, tz: PK },
      { name: "Quetta", lat: 30.1798, lng: 66.975, tz: PK },
      { name: "Hyderabad", lat: 25.396, lng: 68.3578, tz: PK },
      { name: "Gujranwala", lat: 32.1877, lng: 74.1945, tz: PK },
      { name: "Sialkot", lat: 32.4945, lng: 74.5229, tz: PK },
      { name: "Bahawalpur", lat: 29.3956, lng: 71.6836, tz: PK },
      { name: "Sargodha", lat: 32.0836, lng: 72.6711, tz: PK },
      { name: "Sukkur", lat: 27.7052, lng: 68.8574, tz: PK },
      { name: "Abbottabad", lat: 34.1688, lng: 73.2215, tz: PK },
      { name: "Mardan", lat: 34.1986, lng: 72.0404, tz: PK },
      { name: "Gujrat", lat: 32.5731, lng: 74.0789, tz: PK },
      { name: "Sahiwal", lat: 30.6682, lng: 73.1114, tz: PK },
      { name: "Rahim Yar Khan", lat: 28.4202, lng: 70.2952, tz: PK },
      { name: "Dera Ghazi Khan", lat: 30.0489, lng: 70.6455, tz: PK },
      { name: "Muzaffarabad", lat: 34.37, lng: 73.4711, tz: PK },
      { name: "Mirpur (AJK)", lat: 33.1476, lng: 73.7519, tz: PK },
      { name: "Gilgit", lat: 35.9208, lng: 74.3144, tz: PK },
    ],
  },
  {
    group: "Middle East",
    items: [
      { name: "Makkah", lat: 21.4225, lng: 39.8262, tz: "Asia/Riyadh" },
      { name: "Madinah", lat: 24.4672, lng: 39.6111, tz: "Asia/Riyadh" },
      { name: "Riyadh", lat: 24.7136, lng: 46.6753, tz: "Asia/Riyadh" },
      { name: "Jeddah", lat: 21.4858, lng: 39.1925, tz: "Asia/Riyadh" },
      { name: "Dubai", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" },
      { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773, tz: "Asia/Dubai" },
      { name: "Sharjah", lat: 25.3463, lng: 55.4209, tz: "Asia/Dubai" },
      { name: "Doha", lat: 25.2854, lng: 51.531, tz: "Asia/Qatar" },
      { name: "Kuwait City", lat: 29.3759, lng: 47.9774, tz: "Asia/Kuwait" },
      { name: "Muscat", lat: 23.588, lng: 58.3829, tz: "Asia/Muscat" },
      { name: "Manama", lat: 26.2285, lng: 50.586, tz: "Asia/Bahrain" },
      { name: "Istanbul", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul" },
      { name: "Cairo", lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" },
    ],
  },
  {
    group: "UK & Europe",
    items: [
      { name: "London", lat: 51.5074, lng: -0.1278, tz: "Europe/London" },
      { name: "Birmingham", lat: 52.4862, lng: -1.8904, tz: "Europe/London" },
      { name: "Manchester", lat: 53.4808, lng: -2.2426, tz: "Europe/London" },
      { name: "Bradford", lat: 53.796, lng: -1.7594, tz: "Europe/London" },
      { name: "Glasgow", lat: 55.8642, lng: -4.2518, tz: "Europe/London" },
      { name: "Paris", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" },
      { name: "Berlin", lat: 52.52, lng: 13.405, tz: "Europe/Berlin" },
      { name: "Oslo", lat: 59.9139, lng: 10.7522, tz: "Europe/Oslo" },
    ],
  },
  {
    group: "Americas, Asia & Oceania",
    items: [
      { name: "New York", lat: 40.7128, lng: -74.006, tz: "America/New_York" },
      { name: "Chicago", lat: 41.8781, lng: -87.6298, tz: "America/Chicago" },
      { name: "Houston", lat: 29.7604, lng: -95.3698, tz: "America/Chicago" },
      { name: "Toronto", lat: 43.6532, lng: -79.3832, tz: "America/Toronto" },
      { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869, tz: "Asia/Kuala_Lumpur" },
      { name: "Jakarta", lat: -6.2088, lng: 106.8456, tz: "Asia/Jakarta" },
      { name: "Dhaka", lat: 23.8103, lng: 90.4125, tz: "Asia/Dhaka" },
      { name: "Delhi", lat: 28.6139, lng: 77.209, tz: "Asia/Kolkata" },
      { name: "Kabul", lat: 34.5553, lng: 69.2075, tz: "Asia/Kabul" },
      { name: "Sydney", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney" },
    ],
  },
];

const ALL_PLACES = PLACES.flatMap((g) => g.items);

type MethodKey =
  | "Karachi" | "MuslimWorldLeague" | "UmmAlQura" | "Dubai" | "Qatar" | "Kuwait"
  | "Egyptian" | "Turkey" | "MoonsightingCommittee" | "NorthAmerica" | "Singapore";

const METHODS: { key: MethodKey; label: string }[] = [
  { key: "Karachi", label: "University of Islamic Sciences, Karachi" },
  { key: "MuslimWorldLeague", label: "Muslim World League" },
  { key: "UmmAlQura", label: "Umm al-Qura, Makkah" },
  { key: "Dubai", label: "Dubai (UAE)" },
  { key: "Qatar", label: "Qatar" },
  { key: "Kuwait", label: "Kuwait" },
  { key: "Egyptian", label: "Egyptian General Authority" },
  { key: "Turkey", label: "Diyanet (Turkey)" },
  { key: "MoonsightingCommittee", label: "Moonsighting Committee (UK)" },
  { key: "NorthAmerica", label: "ISNA (North America)" },
  { key: "Singapore", label: "Singapore / Malaysia" },
];

/** Sensible defaults by time zone: the method and school most mosques there follow. */
function defaultsFor(tz: string): { method: MethodKey; hanafi: boolean } {
  if (/Karachi|Kolkata|Dhaka|Kabul/.test(tz)) return { method: "Karachi", hanafi: true };
  if (/Riyadh/.test(tz)) return { method: "UmmAlQura", hanafi: false };
  if (/Dubai|Muscat/.test(tz)) return { method: "Dubai", hanafi: false };
  if (/Qatar|Bahrain/.test(tz)) return { method: "Qatar", hanafi: false };
  if (/Kuwait/.test(tz)) return { method: "Kuwait", hanafi: false };
  if (/Cairo/.test(tz)) return { method: "Egyptian", hanafi: false };
  if (/Istanbul/.test(tz)) return { method: "Turkey", hanafi: true };
  if (/^America\//.test(tz)) return { method: "NorthAmerica", hanafi: false };
  if (/^Europe\//.test(tz)) return { method: "MoonsightingCommittee", hanafi: false };
  if (/Kuala_Lumpur|Jakarta|Singapore/.test(tz)) return { method: "Singapore", hanafi: false };
  return { method: "MuslimWorldLeague", hanafi: false };
}

/** The calendar date in a time zone, as a local Date adhan can read y/m/d from. */
function dateIn(tz: string, d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [y, m, day] = parts.split("-").map(Number);
  return new Date(y, m - 1, day);
}

const PRAYERS = [
  { key: "fajr", label: "Fajr" },
  { key: "sunrise", label: "Sunrise" },
  { key: "dhuhr", label: "Dhuhr" },
  { key: "asr", label: "Asr" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha", label: "Isha" },
] as const;

function compassPoint(deg: number) {
  const pts = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return pts[Math.round(deg / 22.5) % 16];
}

function Prayer({ slug, focus }: { slug: string; focus: "times" | "qibla" }) {
  const [adhan, setAdhan] = useState<typeof import("adhan") | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [place, setPlace] = useState<Place>(ALL_PLACES[0]);
  const [method, setMethod] = useState<MethodKey>("Karachi");
  const [hanafi, setHanafi] = useState(true);
  const [locating, setLocating] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    import("adhan")
      .then((m) => setAdhan(() => m))
      .catch(() => notify.error("Could not load the calculator", "Please refresh the page."));
    // the clock starts after mount so server and client HTML match
    const first = requestAnimationFrame(() => setNow(new Date()));
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(tick);
    };
  }, []);

  const choose = (p: Place) => {
    setPlace(p);
    const d = defaultsFor(p.tz);
    setMethod(d.method);
    setHanafi(d.hanafi);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      notify.error("Location not supported", "Pick your city from the list instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        choose({ name: "Your location", lat: pos.coords.latitude, lng: pos.coords.longitude, tz });
        notify.success("Location found", "Times are now for where you are.");
      },
      (err) => {
        setLocating(false);
        notify.error(
          err.code === err.PERMISSION_DENIED ? "Location permission denied" : "Could not get your location",
          "Pick your city from the list instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const startCompass = async () => {
    type IOSOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
    const DOE = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined) as IOSOrientation | undefined;
    if (!DOE) {
      notify.info("No compass on this device", "Use the bearing in degrees with any compass app.");
      return;
    }
    try {
      if (DOE.requestPermission && (await DOE.requestPermission()) !== "granted") {
        notify.error("Compass permission denied");
        return;
      }
    } catch {
      notify.error("Could not start the compass");
      return;
    }
    const onOrient = (e: DeviceOrientationEvent) => {
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof ios === "number") setHeading(ios);
      else if (e.absolute && typeof e.alpha === "number") setHeading((360 - e.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", onOrient as EventListener);
    window.addEventListener("deviceorientation", onOrient);
    notify.info("Compass on", "Hold your phone flat and turn until the Kaaba marker points up.");
  };

  const calc = useMemo(() => {
    if (!adhan || !now) return null;
    const coords = new adhan.Coordinates(place.lat, place.lng);
    const params = adhan.CalculationMethod[method]();
    params.madhab = hanafi ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
    const day = dateIn(place.tz, now);
    const times = new adhan.PrayerTimes(coords, day, params);
    const tomorrow = new adhan.PrayerTimes(coords, new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1), params);
    const upcoming = PRAYERS.filter((p) => p.key !== "sunrise").find((p) => times[p.key] > now);
    const next = upcoming ? { label: upcoming.label, at: times[upcoming.key] } : { label: "Fajr (tomorrow)", at: tomorrow.fajr };
    return { times, next, qibla: adhan.Qibla(coords) };
  }, [adhan, now, place, method, hanafi]);

  useTrackOnce(slug, !!calc);

  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: place.tz });
  const left = calc && now ? Math.max(0, calc.next.at.getTime() - now.getTime()) : 0;
  const countdown = `${Math.floor(left / 3_600_000)}h ${String(Math.floor((left / 60_000) % 60)).padStart(2, "0")}m ${String(
    Math.floor((left / 1000) % 60),
  ).padStart(2, "0")}s`;

  const qiblaCard = calc && (
    <div className="flex flex-col items-center gap-4 rounded-2xl surface p-6 sm:flex-row sm:gap-8">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label={`Qibla is ${Math.round(calc.qibla)} degrees from north`}>
        <g style={{ transform: `rotate(${heading == null ? 0 : -heading}deg)`, transformOrigin: "100px 100px", transition: "transform .2s" }}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="2" />
          {["N", "E", "S", "W"].map((l, i) => (
            <text
              key={l}
              x={100 + 82 * Math.sin((i * Math.PI) / 2)}
              y={105 - 82 * Math.cos((i * Math.PI) / 2)}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="currentColor"
              opacity={l === "N" ? 1 : 0.5}
            >
              {l}
            </text>
          ))}
          <g style={{ transform: `rotate(${calc.qibla}deg)`, transformOrigin: "100px 100px" }}>
            <line x1="100" y1="100" x2="100" y2="58" stroke="#10b981" strokeWidth="5" strokeLinecap="round" />
            <path d="M100 46 L109 62 L91 62 Z" fill="#10b981" />
            <rect x="94" y="30" width="12" height="12" rx="2" fill="currentColor" />
          </g>
          <circle cx="100" cy="100" r="5" fill="currentColor" />
        </g>
      </svg>
      <div className="text-center sm:text-left">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Qibla direction from {place.name}</p>
        <p className="mt-1 text-3xl font-extrabold">
          {fmt(calc.qibla, 1)}° <span className="text-lg text-muted">{compassPoint(calc.qibla)}</span>
        </p>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Measured clockwise from true north. On a phone, turn on the live compass and rotate until the Kaaba marker points straight up.
        </p>
        <button type="button" onClick={startCompass} className="mt-3 rounded-xl surface px-4 py-2 text-sm font-bold hover:text-brand-400">
          {heading == null ? "Use live compass" : `Heading ${Math.round(heading)}°`}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">City</span>
          <select
            value={place.name}
            onChange={(e) => {
              const p = ALL_PLACES.find((x) => x.name === e.target.value);
              if (p) choose(p);
            }}
            className={field}
          >
            {place.name === "Your location" && <option value="Your location">Your location</option>}
            {PLACES.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="h-[42px] rounded-xl surface px-4 text-sm font-bold transition-colors hover:text-brand-400 disabled:opacity-60"
        >
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>

      {focus === "times" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Calculation method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as MethodKey)} className={field}>
              {METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            value={hanafi ? "hanafi" : "shafi"}
            onChange={(v) => setHanafi(v === "hanafi")}
            options={[
              { value: "hanafi", label: "Hanafi Asr" },
              { value: "shafi", label: "Shafi Asr" },
            ]}
          />
        </div>
      )}

      {!calc || !now ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Calculating">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl surface" />
          ))}
        </div>
      ) : focus === "qibla" ? (
        <div className="mt-6">{qiblaCard}</div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Stat label={`Next: ${calc.next.label}`} value={time(calc.next.at)} strong />
            <Stat label="Time left" value={countdown} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PRAYERS.map((p) => (
              <div
                key={p.key}
                className={`rounded-2xl surface p-4 ${calc.next.label === p.label ? "ring-2 ring-brand-400/60" : ""}`}
              >
                <span className="block text-xs font-bold uppercase tracking-wider text-muted">{p.label}</span>
                <span className="mt-1 block text-xl font-extrabold">{time(calc.times[p.key])}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Times for {place.name} ({place.tz.replace(/_/g, " ")}) on{" "}
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: place.tz })}. Calculated
            astronomically on your device; your local mosque may differ by a few minutes.
          </p>
          <div className="mt-6">{qiblaCard}</div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function CalculatorStudio({ tool }: { tool: Tool }) {
  const slug = tool.slug;
  const panels: Record<string, ReactNode> = {
    "income-tax-pk": <IncomeTaxPk slug={slug} />,
    zakat: <Zakat slug={slug} />,
    emi: <Emi slug={slug} />,
    cgpa: <Cgpa slug={slug} />,
    age: <Age slug={slug} />,
    percentage: <Percentage slug={slug} />,
    bmi: <Bmi slug={slug} />,
    unit: <UnitConverter slug={slug} />,
    currency: <Currency slug={slug} />,
    prayer: <Prayer slug={slug} focus="times" />,
    qibla: <Prayer slug={slug} focus="qibla" />,
  };

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="aurora-border rounded-[26px]"
      >
        <div className="glass rounded-[26px] p-4 sm:p-6">{panels[tool.mode ?? ""] ?? null}</div>
      </motion.div>
    </div>
  );
}

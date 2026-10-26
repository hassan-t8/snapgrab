"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import ShareSheet from "@/components/ShareSheet";
import LeadForm from "@/components/LeadForm";
import { trackEvent } from "@/lib/track-event";

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

const ZODIAC: [number, number, string][] = [
  [1, 20, "Capricorn ♑"], [2, 19, "Aquarius ♒"], [3, 21, "Pisces ♓"], [4, 20, "Aries ♈"], [5, 21, "Taurus ♉"], [6, 21, "Gemini ♊"],
  [7, 23, "Cancer ♋"], [8, 23, "Leo ♌"], [9, 23, "Virgo ♍"], [10, 23, "Libra ♎"], [11, 22, "Scorpio ♏"], [12, 22, "Sagittarius ♐"],
];

/** Western star sign: each entry is the first day of the *next* sign in that month. */
function zodiacOf(month: number, day: number) {
  const [, start, sign] = ZODIAC[month - 1];
  if (day < start) return sign;
  return ZODIAC[month % 12][2];
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
    const hijriDob = toHijri(new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())));
    const hijriNow = toHijri(new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())));
    let hijriAge = hijriNow.year - hijriDob.year;
    if (hijriNow.month < hijriDob.month || (hijriNow.month === hijriDob.month && hijriNow.day < hijriDob.day)) hijriAge -= 1;
    return {
      years,
      months,
      days,
      totalDays,
      totalMonths: years * 12 + months,
      totalWeeks: Math.floor(totalDays / 7),
      totalHours: totalDays * 24,
      untilBirthday,
      bornOn: from.toLocaleDateString("en-GB", { weekday: "long" }),
      nextOn: next.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      turning: next.getFullYear() - from.getFullYear(),
      hijriDob: `${hijriDob.day} ${HIJRI_MONTHS[hijriDob.month - 1]} ${hijriDob.year} AH`,
      hijriAge,
      zodiac: zodiacOf(from.getMonth() + 1, from.getDate()),
    };
  }, [dob, asOf]);
  useTrackOnce(slug, result !== null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date of birth" type="date" value={dob} onChange={setDob} />
        <Field label="Age on (date)" type="date" value={asOf} onChange={setAsOf} hint="Use a job ad's closing date to check eligibility." />
      </div>
      {result ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Stat label="Exact age" value={`${result.years} years, ${result.months} months, ${result.days} days`} strong />
            </div>
            <Stat label="Total months" value={fmt(result.totalMonths, 0)} />
            <Stat label="Total weeks" value={fmt(result.totalWeeks, 0)} />
            <Stat label="Total days" value={fmt(result.totalDays, 0)} />
            <Stat label="Total hours (approx.)" value={fmt(result.totalHours, 0)} />
            <Stat label="You were born on a" value={result.bornOn} />
            <Stat label="Star sign" value={result.zodiac} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-brand-400/30 bg-brand-500/10 p-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted">Next birthday</span>
              <span className="mt-1 block text-lg font-extrabold">
                {result.untilBirthday === 0 ? "Today — happy birthday! 🎉" : `In ${result.untilBirthday} days`}
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                You turn {result.turning} on {result.nextOn}
              </span>
            </div>
            <div className="rounded-2xl surface p-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted">Islamic (Hijri) age</span>
              <span className="mt-1 block text-lg font-extrabold">{result.hijriAge} Hijri years</span>
              <span className="mt-0.5 block text-sm text-muted">Born {result.hijriDob} (Umm al-Qura)</span>
            </div>
          </div>
          <div className="mt-4">
            <ShareSheet
              title="My exact age"
              text={`I am ${result.years} years, ${result.months} months and ${result.days} days old — ${fmt(result.totalDays, 0)} days! Check yours on SnapGrab`}
            />
          </div>
        </>
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

/* ------------------------------------------------------------------ *
 * Hijri (Islamic) date converter — Umm al-Qura calendar from Intl
 * ------------------------------------------------------------------ */

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
  "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhul Qadah", "Dhul Hijjah",
];

const hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

/** Hijri day/month/year of a UTC calendar date. */
function toHijri(d: Date) {
  const parts = Object.fromEntries(hijriFmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { day: Number(parts.day), month: Number(parts.month), year: Number(String(parts.year).replace(/\D/g, "")) };
}

const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Gregorian date for a Hijri date (searches around the arithmetic estimate). */
function fromHijri(y: number, m: number, day: number): Date | null {
  const approx = Math.round((y - 1) * 354.36707 + (m - 1) * 29.530589 + day) - 492_148; // days since 1970 (approx.)
  const base = new Date(approx * 86_400_000);
  for (let off = -40; off <= 40; off++) {
    const g = addDays(base, off);
    const h = toHijri(g);
    if (h.year === y && h.month === m && h.day === day) return g;
  }
  return null;
}

const gregLong = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function Hijri({ slug }: { slug: string }) {
  const [mode, setMode] = useState<"g2h" | "h2g">("g2h");
  const [greg, setGreg] = useState("");
  const [hy, setHy] = useState("1448");
  const [hm, setHm] = useState("9");
  const [hd, setHd] = useState("1");
  const [adjust, setAdjust] = useState<"-1" | "0" | "1">("0");

  // today is only known in the browser — fill it in after mount so server and client HTML match
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const now = new Date();
      setGreg(isoDay(utcDay(now.getFullYear(), now.getMonth(), now.getDate())));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const shift = Number(adjust);
  const g2h = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(greg)) return null;
    const [y, m, d] = greg.split("-").map(Number);
    const date = utcDay(y, m - 1, d);
    // a local moon sighting one day later means the Hijri date is one day behind
    return { date, h: toHijri(addDays(date, -shift)) };
  }, [greg, shift]);
  const h2g = useMemo(() => {
    const g = fromHijri(num(hy), num(hm), num(hd));
    return g ? addDays(g, shift) : null;
  }, [hy, hm, hd, shift]);
  useTrackOnce(slug, mode === "g2h" ? !!g2h : !!h2g);

  return (
    <>
      <Toggle
        value={mode}
        onChange={setMode}
        options={[
          { value: "g2h", label: "English → Islamic" },
          { value: "h2g", label: "Islamic → English" },
        ]}
      />
      {mode === "g2h" ? (
        <div className="mt-4">
          <Field label="Date" type="date" value={greg} onChange={setGreg} />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Day" value={hd} onChange={setHd} placeholder="1" />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Month</span>
            <select value={hm} onChange={(e) => setHm(e.target.value)} className={field}>
              {HIJRI_MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {i + 1}. {m}
                </option>
              ))}
            </select>
          </label>
          <Field label="Year (AH)" value={hy} onChange={setHy} placeholder="1448" />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Moon sighting:</span>
        <Toggle
          value={adjust}
          onChange={setAdjust}
          options={[
            { value: "-1", label: "1 day earlier" },
            { value: "0", label: "Umm al-Qura" },
            { value: "1", label: "1 day later (often Pakistan)" },
          ]}
        />
      </div>
      <div className="mt-5">
        {mode === "g2h" ? (
          g2h ? (
            <Stat label={gregLong(g2h.date)} value={`${g2h.h.day} ${HIJRI_MONTHS[g2h.h.month - 1]} ${g2h.h.year} AH`} strong />
          ) : (
            <Stat label="Islamic date" value="—" />
          )
        ) : h2g ? (
          <Stat label={`${num(hd)} ${HIJRI_MONTHS[num(hm) - 1]} ${num(hy)} AH`} value={gregLong(h2g)} strong />
        ) : (
          <Stat label="English date" value="Not a valid Islamic date" />
        )}
      </div>
      <p className="mt-4 text-xs text-muted">
        Calculated with the Umm al-Qura calendar used in Saudi Arabia. Pakistan, India and the UK follow local moon sighting
        (Ruet-e-Hilal), which is often one day later — use the adjustment above.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Ramadan Sehri & Iftar timetable — adhan, same city list as Prayer
 * ------------------------------------------------------------------ */

function Ramadan({ slug }: { slug: string }) {
  const [adhan, setAdhan] = useState<typeof import("adhan") | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [place, setPlace] = useState<Place>(ALL_PLACES[0]);
  const [method, setMethod] = useState<MethodKey>("Karachi");
  const [hanafi, setHanafi] = useState(true);
  const [caution, setCaution] = useState("0");
  const [adjust, setAdjust] = useState<"-1" | "0" | "1">("1");

  useEffect(() => {
    import("adhan")
      .then((m) => setAdhan(() => m))
      .catch(() => notify.error("Could not load the calculator", "Please refresh the page."));
    const id = requestAnimationFrame(() => setToday(new Date()));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows = useMemo(() => {
    if (!adhan || !today) return null;
    // the next Ramadan that has not finished yet
    const t = toHijri(utcDay(today.getFullYear(), today.getMonth(), today.getDate()));
    let year = t.month > 9 || (t.month === 9 && t.day > 29) ? t.year + 1 : t.year;
    let start = fromHijri(year, 9, 1);
    if (!start) {
      year += 1;
      start = fromHijri(year, 9, 1);
    }
    if (!start) return null;
    start = addDays(start, Number(adjust));
    const coords = new adhan.Coordinates(place.lat, place.lng);
    const params = adhan.CalculationMethod[method]();
    params.madhab = hanafi ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
    const pad = Math.max(0, Math.min(15, num(caution)));
    const fmtT = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: place.tz });
    return {
      year,
      days: Array.from({ length: 30 }, (_, i) => {
        const g = addDays(start, i);
        const local = new Date(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate());
        const pt = new adhan.PrayerTimes(coords, local, params);
        return {
          n: i + 1,
          date: g.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
          sehri: fmtT(new Date(pt.fajr.getTime() - pad * 60_000)),
          iftar: fmtT(pt.maghrib),
          isToday: isoDay(g) === isoDay(utcDay(today.getFullYear(), today.getMonth(), today.getDate())),
        };
      }),
    };
  }, [adhan, today, place, method, hanafi, caution, adjust]);
  useTrackOnce(slug, !!rows);

  const choose = (p: Place) => {
    setPlace(p);
    const d = defaultsFor(p.tz);
    setMethod(d.method);
    setHanafi(d.hanafi);
    setAdjust(/Karachi|Kolkata|Dhaka|Europe\//.test(p.tz) ? "1" : "0");
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Stop Sehri earlier by (minutes)" value={caution} onChange={setCaution} hint="Many timetables add 5–10 minutes of caution." />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">First roza (moon sighting)</span>
          <select value={adjust} onChange={(e) => setAdjust(e.target.value as "-1" | "0" | "1")} className={field}>
            <option value="-1">1 day before Saudi</option>
            <option value="0">Same day as Saudi (Umm al-Qura)</option>
            <option value="1">1 day after Saudi (usual in Pakistan)</option>
          </select>
        </label>
      </div>

      {!rows ? (
        <div className="mt-6 h-64 animate-pulse rounded-2xl surface" aria-busy="true" />
      ) : (
        <>
          <h3 className="mt-6 text-lg font-extrabold">
            Ramadan {rows.year} AH timetable — {place.name}
          </h3>
          <div className="mt-3 overflow-x-auto rounded-2xl surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-3 sm:px-4">Roza</th>
                  <th className="px-3 py-3 sm:px-4">Date</th>
                  <th className="px-3 py-3 sm:px-4">Sehri ends</th>
                  <th className="px-3 py-3 sm:px-4">Iftar</th>
                </tr>
              </thead>
              <tbody>
                {rows.days.map((r) => (
                  <tr key={r.n} className={`border-t border-[var(--line)] ${r.isToday ? "bg-brand-500/15 font-bold" : ""}`}>
                    <td className="px-3 py-2 sm:px-4">{r.n}</td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">{r.date}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold sm:px-4">{r.sehri}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold sm:px-4">{r.iftar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                trackEvent("print", slug);
                window.print();
              }}
              className="rounded-xl surface px-4 py-2.5 text-sm font-bold hover:border-brand-400/60"
            >
              Print timetable
            </button>
            <ShareSheet
              title={`Ramadan ${rows.year} timetable — ${place.name}`}
              text={`Sehri & Iftar times for ${place.name}, Ramadan ${rows.year}`}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Sehri ends at Fajr; Iftar is at Maghrib. Times are calculated astronomically for {place.name}; the first fast depends
            on the official moon sighting, so check the announcement and adjust above.
          </p>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Date difference, add/subtract days, countdown
 * ------------------------------------------------------------------ */

function DateDiff({ slug }: { slug: string }) {
  const [tab, setTab] = useState<"between" | "add">("between");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [days, setDays] = useState("30");
  const [sign, setSign] = useState<"add" | "sub">("add");
  const [workdays, setWorkdays] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const now = new Date();
      const t = isoDay(utcDay(now.getFullYear(), now.getMonth(), now.getDate()));
      setA(t);
      setB(isoDay(utcDay(now.getFullYear(), 11, 31)));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
  const da = parse(a);
  const db = parse(b);

  const between = useMemo(() => {
    if (!da || !db) return null;
    const [s, e] = da <= db ? [da, db] : [db, da];
    const total = Math.round((e.getTime() - s.getTime()) / 86_400_000);
    let y = e.getUTCFullYear() - s.getUTCFullYear();
    let m = e.getUTCMonth() - s.getUTCMonth();
    let d = e.getUTCDate() - s.getUTCDate();
    if (d < 0) {
      m -= 1;
      d += new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 0)).getUTCDate();
    }
    if (m < 0) {
      y -= 1;
      m += 12;
    }
    let business = 0;
    for (let t = s.getTime(); t < e.getTime(); t += 86_400_000) {
      const wd = new Date(t).getUTCDay();
      if (wd !== 0 && wd !== 6) business++;
    }
    return { total, y, m, d, weeks: Math.floor(total / 7), rem: total % 7, business };
  }, [da, db]);

  const added = useMemo(() => {
    if (!da) return null;
    const n = Math.round(num(days)) * (sign === "add" ? 1 : -1);
    if (!workdays) return addDays(da, n);
    let left = Math.abs(n);
    let t = da;
    while (left > 0) {
      t = addDays(t, n > 0 ? 1 : -1);
      const wd = t.getUTCDay();
      if (wd !== 0 && wd !== 6) left--;
    }
    return t;
  }, [da, days, sign, workdays]);
  useTrackOnce(slug, tab === "between" ? !!between : !!added);

  return (
    <>
      <Toggle
        value={tab}
        onChange={setTab}
        options={[
          { value: "between", label: "Days between dates" },
          { value: "add", label: "Add / subtract days" },
        ]}
      />
      {tab === "between" ? (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Start date" type="date" value={a} onChange={setA} />
            <Field label="End date" type="date" value={b} onChange={setB} />
          </div>
          {between && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Stat label="Total days" value={`${between.total.toLocaleString()} days`} strong />
              <Stat label="Years, months, days" value={`${between.y}y ${between.m}m ${between.d}d`} />
              <Stat label="Weeks" value={`${between.weeks} weeks ${between.rem} days`} />
              <Stat label="Working days (Mon–Fri)" value={between.business.toLocaleString()} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Field label="Start date" type="date" value={a} onChange={setA} />
            <Toggle
              value={sign}
              onChange={setSign}
              options={[
                { value: "add", label: "+ Add" },
                { value: "sub", label: "− Subtract" },
              ]}
            />
            <Field label="Days" value={days} onChange={setDays} placeholder="30" />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={workdays} onChange={(e) => setWorkdays(e.target.checked)} className="h-4 w-4 accent-brand-500" />
            Count working days only (skip Saturday and Sunday)
          </label>
          {added && (
            <div className="mt-5">
              <Stat label="Result" value={gregLong(added)} strong />
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Discount + sales tax / GST
 * ------------------------------------------------------------------ */

function Discount({ slug }: { slug: string }) {
  const [price, setPrice] = useState("5000");
  const [off, setOff] = useState("20");
  const [extra, setExtra] = useState("");
  const [tax, setTax] = useState("0");
  const [taxMode, setTaxMode] = useState<"add" | "inclusive">("add");

  const p = num(price);
  const afterFirst = p * (1 - Math.min(100, num(off)) / 100);
  const afterAll = afterFirst * (1 - Math.min(100, num(extra)) / 100);
  const t = num(tax) / 100;
  const taxAmt = taxMode === "add" ? afterAll * t : afterAll - afterAll / (1 + t);
  const final = taxMode === "add" ? afterAll + taxAmt : afterAll;
  useTrackOnce(slug, p > 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Original price" value={price} onChange={setPrice} placeholder="5000" />
        <Field label="Discount %" value={off} onChange={setOff} placeholder="20" />
        <Field label="Extra discount % (optional)" value={extra} onChange={setExtra} placeholder="10" hint="Applied after the first discount." />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Sales tax / GST %" value={tax} onChange={setTax} placeholder="18" hint="Pakistan GST is 18% on most goods; enter 0 to skip." />
        <Toggle
          value={taxMode}
          onChange={setTaxMode}
          options={[
            { value: "add", label: "Add tax" },
            { value: "inclusive", label: "Price includes tax" },
          ]}
        />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="You pay" value={fmt(final)} strong />
        <Stat label="You save" value={`${fmt(p - afterAll)} (${p ? fmt(((p - afterAll) / p) * 100, 1) : 0}%)`} />
        <Stat label="Price after discount" value={fmt(afterAll)} />
        <Stat label={taxMode === "add" ? "Tax added" : "Tax included"} value={fmt(taxAmt)} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Typing speed test
 * ------------------------------------------------------------------ */

const PASSAGES = [
  "The quick brown fox jumps over the lazy dog while the sun sets slowly behind the hills, painting the sky in shades of orange and pink.",
  "Practice makes progress. Typing a little every day builds speed and accuracy far better than one long session once a week.",
  "Pakistan is home to some of the highest mountains in the world, including K2, which climbers from every country dream of reaching.",
  "Good habits are easy to start and hard to keep. Write down one small goal for tomorrow and finish it before checking your phone.",
  "A clear CV, a short cover letter and a friendly follow-up email can open more doors than you expect in a busy job market.",
  "Cricket fans fill the stadium early, waving green flags and cheering loudly long before the first ball is bowled.",
];

function TypingTest({ slug }: { slug: string }) {
  const [seconds, setSeconds] = useState<30 | 60 | 120>(60);
  const [passage, setPassage] = useState(0);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const target = useMemo(() => Array.from({ length: 6 }, (_, i) => PASSAGES[(passage + i) % PASSAGES.length]).join(" "), [passage]);
  const elapsed = startedAt ? Math.min(seconds, (now - startedAt) / 1000) : 0;
  const finished = startedAt !== null && elapsed >= seconds;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const b = Number(localStorage.getItem("sg-typing-best"));
        if (b) setBest(b);
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!startedAt || finished) return;
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [startedAt, finished]);

  let correct = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
  // a few keys in the first second would show an absurd speed, so measure over at least 5 s
  const minutes = Math.max(elapsed, 5) / 60;
  const wpm = Math.round(correct / 5 / minutes);
  const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100;

  useEffect(() => {
    if (!finished || !wpm) return;
    const id = requestAnimationFrame(() => {
      if (!best || wpm > best) {
        setBest(wpm);
        try {
          localStorage.setItem("sg-typing-best", String(wpm));
        } catch {}
        notify.success("New personal best!", `${wpm} words per minute`);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  useTrackOnce(slug, finished);

  const restart = (next = false) => {
    setTyped("");
    setStartedAt(null);
    setNow(0);
    if (next) setPassage((p) => (p + 1) % PASSAGES.length);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          value={String(seconds) as "30" | "60" | "120"}
          onChange={(v) => {
            setSeconds(Number(v) as 30 | 60 | 120);
            restart();
          }}
          options={[
            { value: "30", label: "30 sec" },
            { value: "60", label: "1 min" },
            { value: "120", label: "2 min" },
          ]}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Time left" value={`${Math.ceil(seconds - elapsed)}s`} />
        <Stat label="Speed" value={`${startedAt ? wpm : 0} WPM`} strong />
        <Stat label="Accuracy" value={`${accuracy}%`} />
      </div>

      <div
        className="mt-4 max-h-44 overflow-y-auto rounded-2xl bg-[var(--bg-soft)] p-4 font-mono text-[15px] leading-relaxed"
        onClick={() => inputRef.current?.focus()}
        aria-hidden
      >
        {target.slice(0, Math.max(typed.length + 160, 220)).split("").map((ch, i) => (
          <span
            key={i}
            className={
              i < typed.length
                ? typed[i] === ch
                  ? "text-accent-400"
                  : "rounded bg-red-500/30 text-red-300"
                : i === typed.length
                  ? "rounded bg-brand-500/30"
                  : "text-muted"
            }
          >
            {ch}
          </span>
        ))}
      </div>

      <textarea
        ref={inputRef}
        value={typed}
        disabled={finished}
        onChange={(e) => {
          if (!startedAt) {
            const t = Date.now();
            setStartedAt(t);
            setNow(t);
          }
          setTyped(e.target.value.slice(0, target.length));
        }}
        onPaste={(e) => e.preventDefault()}
        rows={3}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Start typing the text above — the timer starts with your first key."
        aria-label="Type here"
        className={`${field} mt-3 font-mono`}
      />

      {finished && (
        <div className="mt-4 rounded-2xl border border-accent-500/30 bg-accent-500/10 p-4">
          <p className="text-lg font-extrabold">
            {wpm} WPM · {accuracy}% accuracy
          </p>
          <p className="mt-1 text-sm text-muted">
            {wpm >= 60 ? "Excellent — faster than most office typists." : wpm >= 40 ? "Good — above the average of about 40 WPM." : "Keep practising a few minutes a day; most people reach 40 WPM within weeks."}
            {best ? ` Your best: ${best} WPM.` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => restart(true)} className="rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-2 text-sm font-bold text-white">
              Try another text
            </button>
            <ShareSheet title="My typing speed" text={`I type ${wpm} words per minute with ${accuracy}% accuracy. Beat me on SnapGrab!`} />
          </div>
        </div>
      )}
      {!finished && startedAt && (
        <button type="button" onClick={() => restart()} className="mt-3 text-sm font-semibold text-muted underline hover:text-[var(--fg)]">
          Restart
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Gold rate calculator — tola / gram / masha / ratti, karat, making
 * ------------------------------------------------------------------ */

const TOLA_G = 11.6638;
const GOLD_UNITS = { tola: TOLA_G, gram: 1, masha: TOLA_G / 12, ratti: TOLA_G / 96, ounce: 31.1035 } as const;
const KARATS = [24, 22, 21, 18] as const;

function Gold({ slug }: { slug: string }) {
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState<"tola" | "10g" | "gram">("tola");
  const [tola, setTola] = useState("1");
  const [gram, setGram] = useState("0");
  const [masha, setMasha] = useState("0");
  const [ratti, setRatti] = useState("0");
  const [karat, setKarat] = useState<(typeof KARATS)[number]>(22);
  const [making, setMaking] = useState("");
  const [makingMode, setMakingMode] = useState<"pct" | "fixed">("pct");
  const [deduct, setDeduct] = useState("");

  const perGram24 = num(rate) / (rateUnit === "tola" ? TOLA_G : rateUnit === "10g" ? 10 : 1);
  const grams = num(tola) * GOLD_UNITS.tola + num(gram) + num(masha) * GOLD_UNITS.masha + num(ratti) * GOLD_UNITS.ratti;
  const pure = grams * (karat / 24);
  const metal = pure * perGram24;
  const makingAmt = makingMode === "pct" ? (metal * num(making)) / 100 : num(making);
  const buy = metal + makingAmt;
  const sell = metal * (1 - Math.min(100, num(deduct)) / 100);
  useTrackOnce(slug, perGram24 > 0 && grams > 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Today's 24K gold rate (Rs)" value={rate} onChange={setRate} placeholder="e.g. 285000" hint="Check your local sarafa or jeweller's board rate." />
        <Toggle
          value={rateUnit}
          onChange={setRateUnit}
          options={[
            { value: "tola", label: "per tola" },
            { value: "10g", label: "per 10 g" },
            { value: "gram", label: "per gram" },
          ]}
        />
      </div>

      <p className="mb-1.5 mt-5 text-sm font-semibold">Weight</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Tola" value={tola} onChange={setTola} />
        <Field label="Masha" value={masha} onChange={setMasha} hint="12 masha = 1 tola" />
        <Field label="Ratti" value={ratti} onChange={setRatti} hint="8 ratti = 1 masha" />
        <Field label="+ Grams" value={gram} onChange={setGram} />
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-sm font-semibold">Purity</span>
        <Toggle
          value={String(karat) as "24" | "22" | "21" | "18"}
          onChange={(v) => setKarat(Number(v) as (typeof KARATS)[number])}
          options={KARATS.map((k) => ({ value: String(k) as "24" | "22" | "21" | "18", label: `${k}K` }))}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Field label={makingMode === "pct" ? "Making charges (%)" : "Making charges (Rs)"} value={making} onChange={setMaking} placeholder={makingMode === "pct" ? "8" : "15000"} />
        <Toggle
          value={makingMode}
          onChange={setMakingMode}
          options={[
            { value: "pct", label: "%" },
            { value: "fixed", label: "Rs" },
          ]}
        />
        <Field label="Deduction when selling (%)" value={deduct} onChange={setDeduct} placeholder="10" hint="Polish / wastage cut most jewellers take." />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Buying price (gold + making)" value={rs(buy)} strong />
        <Stat label="Value of the gold only" value={rs(metal)} />
        <Stat label="Approx. selling price" value={rs(sell)} />
        <Stat label="Weight" value={`${fmt(grams, 3)} g · ${fmt(grams / TOLA_G, 3)} tola · pure ${fmt(pure, 3)} g`} />
      </div>
      <p className="mt-4 text-xs text-muted">
        1 tola = 11.6638 g = 12 masha = 96 ratti. {karat}K gold is {fmt((karat / 24) * 100, 1)}% pure. Shops use their own making
        and deduction rates — ask before you buy or sell. For Zakat on gold, use the{" "}
        <Link href="/tools/zakat-calculator" className="underline hover:text-brand-400">
          Zakat Calculator
        </Link>
        .
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Solar / UPS load calculator
 * ------------------------------------------------------------------ */

type Appliance = { id: number; name: string; watts: string; qty: string; hours: string };

const APPLIANCE_PRESETS: { name: string; watts: number; hours: number }[] = [
  { name: "Ceiling fan (AC)", watts: 75, hours: 12 },
  { name: "Ceiling fan (DC inverter)", watts: 35, hours: 12 },
  { name: "LED bulb", watts: 12, hours: 6 },
  { name: "LED tube light", watts: 20, hours: 6 },
  { name: "Refrigerator", watts: 150, hours: 12 },
  { name: "LED TV 43\"", watts: 90, hours: 5 },
  { name: "Laptop", watts: 60, hours: 6 },
  { name: "Desktop PC", watts: 200, hours: 6 },
  { name: "Wi-Fi router", watts: 10, hours: 24 },
  { name: "Phone charger", watts: 10, hours: 3 },
  { name: "Inverter AC 1 ton", watts: 900, hours: 8 },
  { name: "Inverter AC 1.5 ton", watts: 1300, hours: 8 },
  { name: "Water pump (1 hp)", watts: 750, hours: 1 },
  { name: "Washing machine", watts: 500, hours: 1 },
  { name: "Iron", watts: 1000, hours: 0.5 },
  { name: "Microwave", watts: 1200, hours: 0.3 },
];

const INVERTER_SIZES = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

function SolarLoad({ slug }: { slug: string }) {
  const [items, setItems] = useState<Appliance[]>([
    { id: 1, name: "Ceiling fan (AC)", watts: "75", qty: "4", hours: "12" },
    { id: 2, name: "LED bulb", watts: "12", qty: "8", hours: "6" },
    { id: 3, name: "Refrigerator", watts: "150", qty: "1", hours: "12" },
    { id: 4, name: "LED TV 43\"", watts: "90", qty: "1", hours: "5" },
  ]);
  const [sunHours, setSunHours] = useState("5");
  const [panelW, setPanelW] = useState("585");
  const [backup, setBackup] = useState("4");
  const [unitRate, setUnitRate] = useState("");
  const nextId = useRef(10);

  const update = (id: number, key: keyof Appliance, v: string) => setItems((list) => list.map((a) => (a.id === id ? { ...a, [key]: v } : a)));
  const add = (preset?: (typeof APPLIANCE_PRESETS)[number]) =>
    setItems((list) => [
      ...list,
      { id: nextId.current++, name: preset?.name ?? "Appliance", watts: String(preset?.watts ?? ""), qty: "1", hours: String(preset?.hours ?? "") },
    ]);

  const peakW = items.reduce((n, a) => n + num(a.watts) * num(a.qty), 0);
  const dailyWh = items.reduce((n, a) => n + num(a.watts) * num(a.qty) * Math.min(24, num(a.hours)), 0);
  const monthlyUnits = (dailyWh * 30) / 1000;
  const inverterKva = INVERTER_SIZES.find((s) => s * 1000 * 0.8 >= peakW * 1.25) ?? Math.ceil((peakW * 1.25) / 800);
  // 80% system efficiency (heat, wiring, inverter losses)
  const solarKw = dailyWh / 1000 / (Math.max(1, num(sunHours)) * 0.8);
  const panels = Math.ceil((solarKw * 1000) / Math.max(100, num(panelW)));
  // backup for the running load at night, 80% usable battery capacity
  const avgW = dailyWh / 24;
  const batteryKwh = (avgW * num(backup)) / 1000 / 0.8;
  const bill = num(unitRate) * monthlyUnits;
  useTrackOnce(slug, peakW > 0);

  return (
    <>
      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_90px_70px_80px_36px] gap-2 px-1 text-xs font-bold uppercase tracking-wider text-muted sm:grid">
          <span>Appliance</span>
          <span>Watts</span>
          <span>Qty</span>
          <span>Hours/day</span>
          <span />
        </div>
        {items.map((a) => (
          <div key={a.id} className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 rounded-2xl bg-[var(--bg-soft)] p-2 sm:grid-cols-[1fr_90px_70px_80px_36px] sm:bg-transparent sm:p-0">
            <input value={a.name} onChange={(e) => update(a.id, "name", e.target.value)} aria-label="Appliance" className={`${field} col-span-4 sm:col-span-1`} />
            <input value={a.watts} onChange={(e) => update(a.id, "watts", e.target.value)} inputMode="decimal" aria-label="Watts" placeholder="W" className={field} />
            <input value={a.qty} onChange={(e) => update(a.id, "qty", e.target.value)} inputMode="decimal" aria-label="Quantity" placeholder="Qty" className={field} />
            <input value={a.hours} onChange={(e) => update(a.id, "hours", e.target.value)} inputMode="decimal" aria-label="Hours per day" placeholder="h" className={field} />
            <button
              type="button"
              onClick={() => setItems((list) => list.filter((x) => x.id !== a.id))}
              aria-label={`Remove ${a.name}`}
              className="grid place-items-center rounded-xl text-muted hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value=""
          onChange={(e) => {
            const p = APPLIANCE_PRESETS.find((x) => x.name === e.target.value);
            if (p) add(p);
          }}
          aria-label="Add a common appliance"
          className={`${field} w-auto`}
        >
          <option value="">+ Add common appliance…</option>
          {APPLIANCE_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} — {p.watts} W
            </option>
          ))}
        </select>
        <button type="button" onClick={() => add()} className="flex items-center gap-1.5 rounded-xl surface px-4 py-2.5 text-sm font-bold hover:border-brand-400/60">
          <Plus className="h-4 w-4" /> Custom
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Field label="Sun hours/day" value={sunHours} onChange={setSunHours} hint="Pakistan: about 5" />
        <Field label="Panel size (W)" value={panelW} onChange={setPanelW} />
        <Field label="Backup needed (hours)" value={backup} onChange={setBackup} />
        <Field label="Your rate per unit (Rs)" value={unitRate} onChange={setUnitRate} placeholder="Optional" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Inverter size" value={`${inverterKva} kVA / kW`} strong />
        <Stat label="Solar panels" value={`${fmt(solarKw, 1)} kW · about ${panels} × ${num(panelW)} W`} />
        <Stat label="Peak load" value={`${fmt(peakW, 0)} W`} />
        <Stat label="Units used" value={`${fmt(dailyWh / 1000, 1)} per day · ${fmt(monthlyUnits, 0)} per month`} />
        <Stat label={`Battery for ${num(backup)} h backup`} value={`${fmt(batteryKwh, 1)} kWh (≈ ${Math.ceil((batteryKwh * 1000) / (12 * 100))} × 12 V 100 Ah)`} />
        <Stat label="Monthly bill this load would cost" value={bill ? rs(bill) : "Enter your per-unit rate"} />
      </div>
      <p className="mt-4 text-xs text-muted">
        Estimates for planning: inverter with 25% headroom at 0.8 power factor, panels at 80% system efficiency, batteries at 80%
        usable depth. Motors (pumps, ACs, fridges) draw 3–5× their rating for a moment when starting — a qualified installer
        should confirm the final design.
      </p>
      {peakW > 0 && (
        <div className="mt-5">
          <LeadForm
            kind="solar"
            title="Get a free solar quote for this system"
            subtitle="A local solar installer will call you with a price for this setup — free, no obligation."
            details={{
              "Peak load": `${fmt(peakW, 0)} W`,
              "Units per month": fmt(monthlyUnits, 0),
              Inverter: `${inverterKva} kVA`,
              Panels: `${fmt(solarKw, 1)} kW (${panels} × ${num(panelW)} W)`,
              Battery: `${fmt(batteryKwh, 1)} kWh for ${num(backup)} h`,
              Appliances: items.map((a) => `${a.qty}× ${a.name}`).join(", ").slice(0, 300),
            }}
          />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Fuel / trip cost
 * ------------------------------------------------------------------ */

function Fuel({ slug }: { slug: string }) {
  const [tab, setTab] = useState<"trip" | "mileage">("trip");
  const [km, setKm] = useState("250");
  const [kmpl, setKmpl] = useState("14");
  const [price, setPrice] = useState("");
  const [round, setRound] = useState(false);
  const [people, setPeople] = useState("1");
  const [mKm, setMKm] = useState("420");
  const [mL, setML] = useState("30");

  const dist = num(km) * (round ? 2 : 1);
  const litres = num(kmpl) ? dist / num(kmpl) : 0;
  const cost = litres * num(price);
  const mileage = num(mL) ? num(mKm) / num(mL) : 0;
  useTrackOnce(slug, tab === "trip" ? litres > 0 : mileage > 0);

  return (
    <>
      <Toggle
        value={tab}
        onChange={setTab}
        options={[
          { value: "trip", label: "Trip cost" },
          { value: "mileage", label: "My car's mileage" },
        ]}
      />
      {tab === "trip" ? (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Distance (km)" value={km} onChange={setKm} hint="Lahore → Islamabad ≈ 375 km by motorway" />
            <Field label="Mileage (km per litre)" value={kmpl} onChange={setKmpl} hint="City 800cc ≈ 16, 1300cc ≈ 12–14" />
            <Field label="Petrol price (Rs/litre)" value={price} onChange={setPrice} placeholder="Today's price" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={round} onChange={(e) => setRound(e.target.checked)} className="h-4 w-4 accent-brand-500" />
              Return trip (double the distance)
            </label>
            <Field label="Split between people" value={people} onChange={setPeople} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Fuel cost" value={price ? rs(cost) : "Enter price"} strong />
            <Stat label="Fuel needed" value={`${fmt(litres, 1)} litres`} />
            <Stat label="Per person" value={price ? rs(cost / Math.max(1, num(people))) : "—"} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Kilometres driven" value={mKm} onChange={setMKm} hint="Fill the tank, reset the trip meter, drive, then fill up again." />
            <Field label="Litres filled" value={mL} onChange={setML} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Stat label="Mileage" value={`${fmt(mileage, 1)} km/l`} strong />
            <Stat label="Fuel per 100 km" value={mileage ? `${fmt(100 / mileage, 1)} litres` : "—"} />
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Calorie (BMR / TDEE) calculator — Mifflin-St Jeor
 * ------------------------------------------------------------------ */

const ACTIVITY = [
  { value: "1.2", label: "Little or no exercise" },
  { value: "1.375", label: "Light (1–3 days/week)" },
  { value: "1.55", label: "Moderate (3–5 days/week)" },
  { value: "1.725", label: "Active (6–7 days/week)" },
  { value: "1.9", label: "Very active / physical job" },
] as const;

function Calories({ slug }: { slug: string }) {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("28");
  const [weight, setWeight] = useState("70");
  const [unit, setUnit] = useState<"cm" | "ft">("ft");
  const [cm, setCm] = useState("170");
  const [ft, setFt] = useState("5");
  const [inch, setInch] = useState("7");
  const [activity, setActivity] = useState<string>("1.375");

  const heightCm = unit === "cm" ? num(cm) : (num(ft) * 12 + num(inch)) * 2.54;
  const valid = num(age) > 0 && num(weight) > 0 && heightCm > 0;
  const bmr = 10 * num(weight) + 6.25 * heightCm - 5 * num(age) + (sex === "male" ? 5 : -161);
  const tdee = bmr * num(activity);
  useTrackOnce(slug, valid);

  const goals = [
    { label: "Lose 0.5 kg / week", kcal: tdee - 500 },
    { label: "Lose 0.25 kg / week", kcal: tdee - 250 },
    { label: "Maintain weight", kcal: tdee },
    { label: "Gain 0.25 kg / week", kcal: tdee + 250 },
  ];
  const floor = sex === "male" ? 1500 : 1200;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <span className="mb-1.5 block text-sm font-semibold">Sex</span>
          <Toggle
            value={sex}
            onChange={setSex}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
        </div>
        <Field label="Age (years)" value={age} onChange={setAge} />
        <Field label="Weight (kg)" value={weight} onChange={setWeight} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <Toggle
          value={unit}
          onChange={setUnit}
          options={[
            { value: "ft", label: "ft / in" },
            { value: "cm", label: "cm" },
          ]}
        />
        {unit === "cm" ? (
          <Field label="Height (cm)" value={cm} onChange={setCm} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Feet" value={ft} onChange={setFt} />
            <Field label="Inches" value={inch} onChange={setInch} />
          </div>
        )}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Activity</span>
        <select value={activity} onChange={(e) => setActivity(e.target.value)} className={field}>
          {ACTIVITY.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      {valid && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Stat label="Calories to maintain weight" value={`${fmt(tdee, 0)} kcal/day`} strong />
            <Stat label="Resting burn (BMR)" value={`${fmt(bmr, 0)} kcal/day`} />
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl surface">
            {goals.map((g) => (
              <div key={g.label} className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 text-sm first:border-t-0">
                <span>{g.label}</span>
                <span className="font-bold">{fmt(Math.max(floor, g.kcal), 0)} kcal</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Mifflin-St Jeor equation. Targets never go below {floor} kcal, a common safe minimum. Not medical advice — for
            pregnancy, diabetes or other conditions, follow your doctor. Check your weight range with the{" "}
            <Link href="/tools/bmi-calculator" className="underline hover:text-brand-400">
              BMI Calculator
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Merit / aggregate calculator (MDCAT, ECAT, NUST … weights editable)
 * ------------------------------------------------------------------ */

type AggPart = { label: string; obtained: string; total: string; weight: string };

const AGG_PRESETS: { id: string; label: string; note: string; parts: { label: string; total: number; weight: number }[] }[] = [
  {
    id: "mdcat",
    label: "MDCAT (medical)",
    note: "Commonly Matric 10% + FSc 40% + MDCAT 50%.",
    parts: [
      { label: "Matric / SSC", total: 1200, weight: 10 },
      { label: "FSc / HSSC", total: 1200, weight: 40 },
      { label: "MDCAT", total: 200, weight: 50 },
    ],
  },
  {
    id: "ecat",
    label: "ECAT (UET engineering)",
    note: "Commonly Matric 17% + FSc 50% + ECAT 33%.",
    parts: [
      { label: "Matric / SSC", total: 1200, weight: 17 },
      { label: "FSc / HSSC", total: 1100, weight: 50 },
      { label: "ECAT", total: 400, weight: 33 },
    ],
  },
  {
    id: "nust",
    label: "NUST (NET)",
    note: "Commonly Matric 10% + FSc 15% + NET 75%.",
    parts: [
      { label: "Matric / SSC", total: 1200, weight: 10 },
      { label: "FSc / HSSC", total: 1100, weight: 15 },
      { label: "NET", total: 200, weight: 75 },
    ],
  },
  {
    id: "custom",
    label: "Custom",
    note: "Enter the weights from your university's prospectus.",
    parts: [
      { label: "Matric / SSC", total: 1200, weight: 10 },
      { label: "Intermediate", total: 1200, weight: 40 },
      { label: "Entry test", total: 100, weight: 50 },
    ],
  },
];

const presetParts = (id: string): AggPart[] =>
  (AGG_PRESETS.find((p) => p.id === id) ?? AGG_PRESETS[0]).parts.map((p) => ({ label: p.label, obtained: "", total: String(p.total), weight: String(p.weight) }));

function Aggregate({ slug }: { slug: string }) {
  const [preset, setPreset] = useState("mdcat");
  const [parts, setParts] = useState<AggPart[]>(() => presetParts("mdcat"));
  const update = (i: number, key: keyof AggPart, v: string) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, [key]: v } : p)));

  const weightSum = parts.reduce((n, p) => n + num(p.weight), 0);
  const filled = parts.every((p) => num(p.total) > 0 && p.obtained.trim() !== "");
  const aggregate = parts.reduce((n, p) => n + (num(p.total) ? (Math.min(num(p.obtained), num(p.total)) / num(p.total)) * num(p.weight) : 0), 0);
  useTrackOnce(slug, filled);
  const info = AGG_PRESETS.find((p) => p.id === preset)!;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {AGG_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPreset(p.id);
              setParts(presetParts(p.id));
            }}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${preset === p.id ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white" : "surface text-muted"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{info.note} Formulas change — always confirm with the current admission prospectus. You can edit every weight.</p>

      <div className="mt-4 space-y-3">
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--bg-soft)] p-3 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
            <input value={p.label} onChange={(e) => update(i, "label", e.target.value)} aria-label="Part name" className={`${field} col-span-3 font-semibold sm:col-span-1`} />
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted">Obtained</span>
              <input value={p.obtained} onChange={(e) => update(i, "obtained", e.target.value)} inputMode="decimal" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted">Total</span>
              <input value={p.total} onChange={(e) => update(i, "total", e.target.value)} inputMode="decimal" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted">Weight %</span>
              <input value={p.weight} onChange={(e) => update(i, "weight", e.target.value)} inputMode="decimal" className={field} />
            </label>
          </div>
        ))}
      </div>
      {weightSum !== 100 && <p className="mt-2 text-xs text-amber-400">Weights add up to {fmt(weightSum, 1)}% — they should total 100%.</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Your aggregate" value={filled ? `${fmt(aggregate, 4)}%` : "Fill in your marks"} strong />
        <div className="rounded-2xl surface p-4 text-xs text-muted">
          {parts.map((p) => (
            <p key={p.label}>
              {p.label}: {num(p.total) ? fmt((Math.min(num(p.obtained), num(p.total)) / num(p.total)) * num(p.weight), 3) : 0} of {num(p.weight)}
            </p>
          ))}
        </div>
      </div>
      {filled && (
        <div className="mt-4">
          <ShareSheet title="My aggregate" text={`My ${info.label} aggregate is ${fmt(aggregate, 3)}% — calculate yours on SnapGrab`} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Matric / Inter percentage & grade + board result links
 * ------------------------------------------------------------------ */

const GRADE_SCALES = {
  classic: {
    label: "Classic (A+ to E)",
    bands: [
      [80, "A+", "Exceptional"], [70, "A", "Excellent"], [60, "B", "Very good"], [50, "C", "Good"], [40, "D", "Fair"], [33, "E", "Pass"], [0, "F", "Fail"],
    ] as [number, string, string][],
  },
  ibcc: {
    label: "New IBCC scale (A++ to E)",
    bands: [
      [95, "A++", "Exceptional"], [90, "A+", "Outstanding"], [85, "A", "Excellent"], [80, "B++", "Very good"], [75, "B+", "Good"], [70, "B", "Fairly good"],
      [60, "C+", "Above average"], [50, "C", "Average"], [40, "D", "Satisfactory"], [33, "E", "Pass"], [0, "U", "Ungraded"],
    ] as [number, string, string][],
  },
};

const BOARDS: { name: string; url: string }[] = [
  { name: "FBISE Islamabad", url: "https://www.fbise.edu.pk" },
  { name: "BISE Lahore", url: "https://www.biselahore.com" },
  { name: "BISE Gujranwala", url: "https://www.bisegrw.edu.pk" },
  { name: "BISE Faisalabad", url: "http://www.bisefsd.edu.pk" },
  { name: "BISE Rawalpindi", url: "http://www.biserwp.edu.pk" },
  { name: "BISE Multan", url: "https://www.bisemultan.edu.pk" },
  { name: "BISE Bahawalpur", url: "https://bisebwp.edu.pk" },
  { name: "BISE Sargodha", url: "https://www.bisesargodha.edu.pk" },
  { name: "BISE DG Khan", url: "https://www.bisedgkhan.edu.pk" },
  { name: "BISE Sahiwal", url: "https://www.bisesahiwal.edu.pk" },
  { name: "BISE Peshawar", url: "https://www.bisep.edu.pk" },
  { name: "BISE Mardan", url: "https://www.bisemdn.edu.pk" },
  { name: "BISE Abbottabad", url: "https://www.biseatd.edu.pk" },
  { name: "BISE Malakand", url: "https://www.bisemalakand.edu.pk" },
  { name: "BSEK Karachi (Matric)", url: "https://bsek.edu.pk" },
  { name: "BIEK Karachi (Inter)", url: "https://biek.edu.pk" },
  { name: "BISE Sukkur", url: "https://www.bisesuksindh.edu.pk" },
  { name: "BISE Larkana", url: "https://biselrk.edu.pk" },
  { name: "BBISE Quetta", url: "https://bbise.edu.pk" },
];

function MatricGrade({ slug }: { slug: string }) {
  const [obtained, setObtained] = useState("");
  const [total, setTotal] = useState("1100");
  const [scale, setScale] = useState<keyof typeof GRADE_SCALES>("classic");
  const pct = num(total) ? (Math.min(num(obtained), num(total)) / num(total)) * 100 : 0;
  const band = GRADE_SCALES[scale].bands.find(([min]) => pct >= min) ?? GRADE_SCALES[scale].bands.at(-1)!;
  const ok = obtained.trim() !== "" && num(total) > 0;
  useTrackOnce(slug, ok);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Marks obtained" value={obtained} onChange={setObtained} placeholder="e.g. 945" />
        <Field label="Total marks" value={total} onChange={setTotal} hint="Matric 1100/1200 · Inter 1100/1200" />
        <Toggle
          value={scale}
          onChange={setScale}
          options={[
            { value: "classic", label: "A+ to E" },
            { value: "ibcc", label: "IBCC A++" },
          ]}
        />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Percentage" value={ok ? `${fmt(pct, 2)}%` : "—"} strong />
        <Stat label="Grade" value={ok ? band[1] : "—"} />
        <Stat label="Remarks" value={ok ? band[2] : "—"} />
      </div>
      <p className="mt-3 text-xs text-muted">
        {GRADE_SCALES[scale].label}. Boards are moving to IBCC&apos;s new grading — the grade on your result card is final.
      </p>
      {ok && (
        <div className="mt-4">
          <ShareSheet title="My result" text={`I got ${fmt(pct, 2)}% (${band[1]}) — check your percentage and grade on SnapGrab`} />
        </div>
      )}

      <h3 className="mt-6 text-sm font-bold">Official board result websites</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {BOARDS.map((b) => (
          <a
            key={b.url}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center justify-between rounded-xl surface px-3 py-2 text-sm transition-colors hover:border-brand-400/60 hover:text-brand-400"
          >
            {b.name}
            <span className="text-xs text-muted">↗</span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Results are announced by each board on its own website; links open the board&apos;s official site.</p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Electricity units & bill estimator (no hard-coded tariffs)
 * ------------------------------------------------------------------ */

function ElectricityBill({ slug }: { slug: string }) {
  const [prev, setPrev] = useState("");
  const [curr, setCurr] = useState("");
  const [days, setDays] = useState("");
  const [lastBill, setLastBill] = useState("");
  const [lastUnits, setLastUnits] = useState("");
  const [rateDirect, setRateDirect] = useState("");

  const units = Math.max(0, num(curr) - num(prev));
  const projected = num(days) > 0 ? (units / num(days)) * 30 : units;
  const rate = num(rateDirect) || (num(lastUnits) ? num(lastBill) / num(lastUnits) : 0);
  const estimate = projected * rate;
  useTrackOnce(slug, units > 0);

  return (
    <>
      <p className="mb-1.5 text-sm font-semibold">1. Units from your meter</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Previous reading (on last bill)" value={prev} onChange={setPrev} placeholder="e.g. 15230" />
        <Field label="Reading today" value={curr} onChange={setCurr} placeholder="e.g. 15410" />
        <Field label="Days since that reading" value={days} onChange={setDays} placeholder="e.g. 18" hint="To project the full month." />
      </div>
      <p className="mb-1.5 mt-5 text-sm font-semibold">2. Your rate</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Last bill total (Rs)" value={lastBill} onChange={setLastBill} placeholder="e.g. 9800" />
        <Field label="Units on last bill" value={lastUnits} onChange={setLastUnits} placeholder="e.g. 210" />
        <Field label="…or rate per unit (Rs)" value={rateDirect} onChange={setRateDirect} placeholder="Optional" hint="Includes taxes if you use your bill's average." />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Units used so far" value={`${fmt(units, 0)} units`} strong />
        <Stat label="Projected for 30 days" value={`${fmt(projected, 0)} units`} />
        <Stat label="Average rate" value={rate ? `Rs ${fmt(rate, 2)} / unit` : "Enter last bill"} />
        <Stat label="Estimated bill" value={rate ? rs(estimate) : "—"} />
      </div>
      <p className="mt-4 text-xs text-muted">
        Uses your own bill&apos;s average rate (bill ÷ units), so taxes and adjustments are already included. Tariff slabs mean
        crossing 200 or 300 units can raise the rate sharply — keep an eye on the projection. Want to cut units? Try the{" "}
        <Link href="/tools/solar-load-calculator" className="underline hover:text-brand-400">
          Solar &amp; load calculator
        </Link>
        .
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Plot / property area & price
 * ------------------------------------------------------------------ */

const MARLA_STD = { "225": "225 sq ft (most housing societies)", "250": "250 sq ft", "272.25": "272.25 sq ft (revenue records)" } as const;

function Plot({ slug }: { slug: string }) {
  const [len, setLen] = useState("35");
  const [wid, setWid] = useState("70");
  const [marlaFt, setMarlaFt] = useState<keyof typeof MARLA_STD>("225");
  const [price, setPrice] = useState("");
  const [per, setPer] = useState<"marla" | "sqft" | "total">("marla");

  const sqft = num(len) * num(wid);
  const marla = sqft / Number(marlaFt);
  const total = per === "marla" ? marla * num(price) : per === "sqft" ? sqft * num(price) : num(price);
  useTrackOnce(slug, sqft > 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Length (feet)" value={len} onChange={setLen} />
        <Field label="Width (feet)" value={wid} onChange={setWid} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">1 marla =</span>
          <select value={marlaFt} onChange={(e) => setMarlaFt(e.target.value as keyof typeof MARLA_STD)} className={field}>
            {Object.entries(MARLA_STD).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Plot size" value={`${fmt(marla, 2)} marla · ${fmt(marla / 20, 3)} kanal`} strong />
        <Stat label="Area" value={`${fmt(sqft, 0)} sq ft · ${fmt(sqft / 9, 1)} sq yd · ${fmt(sqft * 0.092903, 1)} m²`} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Price (Rs)" value={price} onChange={setPrice} placeholder="e.g. 3500000" />
        <Toggle
          value={per}
          onChange={setPer}
          options={[
            { value: "marla", label: "per marla" },
            { value: "sqft", label: "per sq ft" },
            { value: "total", label: "total" },
          ]}
        />
      </div>
      {num(price) > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label="Total price" value={rs(total)} strong />
          <Stat label="Per marla" value={rs(marla ? total / marla : 0)} />
          <Stat label="Per sq ft" value={rs(sqft ? total / sqft : 0)} />
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        A marla is 225 sq ft in most housing societies (DHA, Bahria and others) but 272.25 sq ft in old revenue records — check
        which one your file uses. 1 kanal = 20 marla. Transfer taxes and fees are not included.
      </p>
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
    hijri: <Hijri slug={slug} />,
    ramadan: <Ramadan slug={slug} />,
    "date-diff": <DateDiff slug={slug} />,
    discount: <Discount slug={slug} />,
    "typing-test": <TypingTest slug={slug} />,
    gold: <Gold slug={slug} />,
    "solar-load": <SolarLoad slug={slug} />,
    fuel: <Fuel slug={slug} />,
    calories: <Calories slug={slug} />,
    aggregate: <Aggregate slug={slug} />,
    "matric-grade": <MatricGrade slug={slug} />,
    "electricity-bill": <ElectricityBill slug={slug} />,
    plot: <Plot slug={slug} />,
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

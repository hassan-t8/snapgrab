"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Download, Eraser, Eye, Loader2, Mail, PenLine, RefreshCw, ShieldCheck, Shuffle, Sparkles, UserRound } from "lucide-react";
import type { PDFFont } from "pdf-lib";
import type { Tool } from "@/lib/tools";
import { notify } from "@/components/Toaster";
import { trackEvent } from "@/lib/track-event";
import ShareSheet from "@/components/ShareSheet";
import { pdfSafe, wrap } from "@/lib/pdf-text";

/* ------------------------------------------------------------------ *
 * model
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "sg-cover-letter-draft";
const CV_KEY = "sg-cv-draft"; // written by CvStudio

const field = "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400";

type Kind = "standard" | "bank" | "teaching" | "government" | "internship";
type Tone = "professional" | "friendly" | "fresher" | "career";
type Format = "letter" | "email";
type Source = "" | "linkedin" | "rozee" | "indeed" | "website" | "newspaper" | "referral" | "jobfair" | "other";

type Letter = {
  kind: Kind;
  tone: Tone;
  format: Format;
  seed: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  linkedin: string;
  cnic: string;
  manager: string;
  managerTitle: string;
  company: string;
  companyAddress: string;
  job: string;
  source: Source;
  sourceDetail: string;
  refNo: string;
  background: string;
  years: string;
  points: [string, string, string];
  why: string;
  availability: string;
  /** yyyy-mm-dd */
  date: string;
  /** hand-edited letter text; null = generated from the form */
  text: string | null;
};

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "standard", label: "Any job", hint: "Private sector, NGOs, abroad" },
  { id: "bank", label: "Bank / finance", hint: "Branch, RM, cash, ops" },
  { id: "teaching", label: "Teaching", hint: "Schools, colleges, academies" },
  { id: "government", label: "Govt. post", hint: "Formal application" },
  { id: "internship", label: "Internship", hint: "Students & fresh grads" },
];

const TONES: { id: Tone; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "fresher", label: "Fresher" },
  { id: "career", label: "Career change" },
];

const SOURCES: { id: Source; label: string; detail?: string; placeholder?: string }[] = [
  { id: "", label: "Don't mention" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "rozee", label: "Rozee.pk" },
  { id: "indeed", label: "Indeed" },
  { id: "website", label: "Company website" },
  { id: "newspaper", label: "Newspaper", detail: "Newspaper and date", placeholder: "Daily Jang, 20 October 2026" },
  { id: "referral", label: "Referral", detail: "Who referred you", placeholder: "Mr. Bilal Ahmed, Branch Manager" },
  { id: "jobfair", label: "Job fair", detail: "Which job fair (optional)", placeholder: "the NUST career fair" },
  { id: "other", label: "Somewhere else", detail: "Where", placeholder: "Facebook group, notice board…" },
];

const AVAILABILITY = {
  job: ["immediately", "after one month's notice", "after two weeks' notice", "after three months' notice"],
  internship: ["immediately", "for 6–8 weeks this summer", "part-time alongside my studies"],
};

function blankLetter(kind: Kind = "standard", tone: Tone = "professional", format: Format = "letter"): Letter {
  return {
    kind,
    tone,
    format,
    seed: 0,
    name: "",
    email: "",
    phone: "",
    address: "",
    linkedin: "",
    cnic: "",
    manager: "",
    managerTitle: "",
    company: "",
    companyAddress: "",
    job: "",
    source: "",
    sourceDetail: "",
    refNo: "",
    background: "",
    years: "",
    points: ["", "", ""],
    why: "",
    availability: "",
    date: "",
    text: null,
  };
}

function sampleLetter(prev: Letter): Letter {
  const base = { ...blankLetter(prev.kind, prev.tone, prev.format), date: prev.date };
  const me = { name: "Ayesha Khan", email: "ayesha.khan@email.com", phone: "+92 300 1234567", address: "House 12, Street 4, Model Town, Lahore", linkedin: "linkedin.com/in/ayeshakhan" };
  switch (prev.kind) {
    case "bank":
      return {
        ...base,
        ...me,
        manager: "",
        managerTitle: "Area Manager, Human Resources",
        company: "Habib Bank Limited",
        companyAddress: "Gulberg Branch, Lahore",
        job: "Relationship Manager",
        source: "rozee",
        background: "Personal Banking Officer",
        years: "3",
        points: [
          "Grew my branch's current-account deposits by 25% in 2025",
          "Handled 60+ walk-in customers a day with zero cash differences",
          "Fully trained on KYC, AML and account-opening procedures",
        ],
        why: "your focus on digital banking and your reputation for training young staff",
        availability: "after one month's notice",
      };
    case "teaching":
      return {
        ...base,
        ...me,
        manager: "Mrs. Saima Raza",
        managerTitle: "Principal",
        company: "The City School",
        companyAddress: "Johar Town Campus, Lahore",
        job: "Science Teacher (Grades 6–8)",
        source: "newspaper",
        sourceDetail: "Daily Dawn",
        background: "Science teacher",
        years: "4",
        points: [
          "Raised my Grade 8 class's average science result from 68% to 81%",
          "Set up the school's first student science fair with 40+ projects",
          "Comfortable with Cambridge-style lesson planning and Google Classroom",
        ],
        why: "",
        availability: "from the start of the next term",
      };
    case "government":
      return {
        ...base,
        ...me,
        cnic: "35202-1234567-8",
        manager: "",
        managerTitle: "Secretary",
        company: "Punjab Public Service Commission",
        companyAddress: "Lahore",
        job: "Assistant (BPS-16)",
        source: "newspaper",
        sourceDetail: "Daily Jang dated 20 October 2026",
        refNo: "24/2026",
        background: "BS Commerce (First Division), University of the Punjab",
        years: "2 years as Accounts Assistant",
        points: ["Proficient in MS Office, Urdu and English typing (40 wpm)", "Experience of office record-keeping and official correspondence", ""],
        why: "",
        availability: "immediately",
      };
    case "internship":
      return {
        ...base,
        ...me,
        tone: prev.tone === "professional" ? "fresher" : prev.tone,
        manager: "",
        managerTitle: "Talent Acquisition Team",
        company: "Systems Limited",
        companyAddress: "Lahore",
        job: "Software Engineering Intern",
        source: "linkedin",
        background: "BS Computer Science (7th semester) at FAST-NUCES Lahore",
        points: [
          "Built a React and Firebase final-year project used by 300+ students",
          "Solved 250+ problems on LeetCode in Java and Python",
          "Volunteer lead at the university's Google Developer Student Club",
        ],
        why: "the hands-on mentorship your interns receive on real client projects",
        availability: "for 6–8 weeks this summer",
      };
    default:
      return {
        ...base,
        ...me,
        manager: "Mr. Usman Tariq",
        managerTitle: "Head of Marketing",
        company: "Daraz",
        companyAddress: "Karachi",
        job: "Digital Marketing Executive",
        source: "linkedin",
        background: "Social Media Executive",
        years: "3",
        points: [
          "Grew a fashion brand's Instagram from 8k to 95k followers in 18 months",
          "Ran Meta and Google ad campaigns with a 4.2x return on ad spend",
          "Wrote bilingual (English/Urdu) content for Eid and 11.11 sale campaigns",
        ],
        why: "your reach across Pakistan and your data-driven approach to marketing",
        availability: "after one month's notice",
      };
  }
}

/* ------------------------------------------------------------------ *
 * writing helpers
 * ------------------------------------------------------------------ */

const t = (s: string) => s.replace(/\s+/g, " ").trim();
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Lower-case the first letter unless the word looks like a name or acronym ("HBL", "Google"). */
function lc(s: string) {
  const first = s.split(/\s/)[0] ?? "";
  const common = /^(your|the|its|their|a|an|how|being|working|helping|this|that|my|our)$/i;
  return common.test(first) ? s[0].toLowerCase() + s.slice(1) : s;
}
/** End with a full stop unless the text already ends in punctuation. */
const end = (s: string) => (/[.!?…]["')\]]?$/.test(s) ? s : `${s}.`);
const stripEnd = (s: string) => s.replace(/[.\s]+$/, "");

/** "a" / "an" for the phrase that follows. */
function article(phrase: string) {
  const w = phrase.trim().split(/\s/)[0] ?? "";
  if (/^[A-Z]{2,}/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? "an" : "a"; // acronyms: "an MBA", "an HR officer"
  if (/^(uni|use|usu|eu|one|once)/i.test(w)) return "a";
  if (/^(hour|honest|honou?r)/i.test(w)) return "an";
  return /^[aeiou]/i.test(w) ? "an" : "a";
}
const withArticle = (s: string) => `${article(s)} ${s}`;

function yearsText(y: string) {
  const s = t(y);
  if (!s) return "";
  if (/^\d+(\.\d+)?\+?$/.test(s)) return `${s} year${s === "1" ? "" : "s"}`;
  return s;
}

/** Variation picker: every slot moves to its next wording each time the seed changes. */
const pick = <T,>(seed: number, slot: number, options: T[]) => options[(seed + slot) % options.length];

function formatDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mi = Number(m[2]) - 1;
  return months[mi] ? `${Number(m[3])} ${months[mi]} ${m[1]}` : iso;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function sourcePhrase(l: Letter) {
  const d = t(l.sourceDetail);
  switch (l.source) {
    case "linkedin":
      return ", advertised on LinkedIn";
    case "rozee":
      return ", advertised on Rozee.pk";
    case "indeed":
      return ", advertised on Indeed";
    case "website":
      return ", advertised on your careers page";
    case "newspaper":
      return `, advertised in ${d || "the newspaper"}`;
    case "jobfair":
      return d ? `, which I learnt about at ${d}` : ", which I learnt about at your job fair stall";
    case "other":
      return d ? `, which I came across on ${d}` : "";
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ *
 * the generator
 * ------------------------------------------------------------------ */

type Parts = { subject: string; body: string };

function compose(l: Letter): Parts {
  const s = l.seed;
  const name = t(l.name) || "Your Name";
  const company = t(l.company);
  const co = company || "your organisation";
  const cos = company ? `${company}'s` : "your organisation's";
  const job = t(l.job);
  const manager = t(l.manager);
  const mTitle = t(l.managerTitle);
  const bg = stripEnd(t(l.background));
  const yrs = yearsText(l.years);
  const points = l.points.map((p) => stripEnd(t(p).replace(/^[-*•–·]\s*/, ""))).filter(Boolean).map(cap);
  const why = stripEnd(t(l.why));
  const avail = stripEnd(t(l.availability));
  const ref = t(l.refNo);
  const email = l.format === "email";
  const intern = l.kind === "internship";
  const tone: Tone = l.tone;
  const friendly = tone === "friendly";
  const contact = [t(l.phone), t(l.email)].filter(Boolean);
  const contactLine = contact.length === 2 ? `${contact[0]} or ${contact[1]}` : contact[0] ?? "";

  /* ---------- government: traditional formal application ---------- */
  if (l.kind === "government") {
    const d = t(l.sourceDetail);
    const where =
      l.source === "newspaper"
        ? ` published in ${d || "the newspaper"}`
        : l.source === "website"
          ? " on your official website"
          : l.source === "linkedin"
            ? " on LinkedIn"
            : l.source === "rozee"
              ? " on Rozee.pk"
              : l.source === "other" && d
                ? ` on ${d}`
                : "";
    const post = job || "the advertised post";
    const subject = `Subject: Application for the Post of ${job || "[Post Name]"}${ref ? ` (Advertisement No. ${ref})` : ""}`;
    const salutation = manager ? `Respected ${manager},` : "Respected Sir/Madam,";
    const paras: string[] = [];
    paras.push(
      `With reference to your advertisement${where}${ref ? ` (Advertisement No. ${ref})` : ""}, I wish to offer my services for the post of ${post} in your esteemed department.`,
    );
    const particulars = [bg && `Qualification: ${bg}`, yrs && `Experience: ${yrs}`, ...points].filter(Boolean) as string[];
    if (particulars.length && !email) {
      paras.push(`I possess the qualifications and experience required for this post. My brief particulars are as follows:\n${particulars.map((p) => `• ${p}`).join("\n")}`);
    } else if (particulars.length) {
      paras.push(particulars.map((p) => `• ${p}`).join("\n"));
    }
    const p3: string[] = [];
    if (why) p3.push(/^(i|my|it|this)\b/i.test(why) ? end(cap(why)) : `I am keen to serve in your department because of ${lc(why)}.`);
    p3.push(
      pick(s, 1, [
        "If given the opportunity, I assure you that I will perform my duties with honesty, dedication and to the best of my abilities.",
        "If selected, I will discharge my duties with honesty, hard work and complete dedication.",
      ]),
    );
    paras.push(p3.join(" "));
    const p4: string[] = [
      email
        ? "My application, CV and copies of my CNIC, domicile and educational certificates are attached."
        : "Copies of my CV, CNIC, domicile and educational certificates are attached for your kind perusal.",
    ];
    if (avail) p4.push(availabilitySentence(avail, false));
    paras.push(p4.join(" "));
    paras.push(
      pick(s, 2, [
        "I request you to kindly consider my application and grant me an opportunity to appear for the test and interview. I shall be very thankful to you.",
        "I shall be grateful if my application is accepted and I am given a chance to appear for the test and interview.",
      ]),
    );
    const details = [t(l.cnic) && `CNIC: ${t(l.cnic)}`, t(l.address), t(l.phone) && `Contact: ${t(l.phone)}`, t(l.email) && `Email: ${t(l.email)}`].filter(Boolean);
    const sig = ["Yours obediently,", "", name, ...details];
    return { subject, body: [subject, "", salutation, "", paras.join("\n\n"), "", sig.join("\n")].join("\n") };
  }

  /* ---------- everyone else ---------- */
  const noun = intern ? "internship" : pick(s, 0, ["position", "role", "position"]);
  const rolePhrase = job ? `the ${job} ${/\b(intern|internship)\b/i.test(job) ? "position" : noun}` : intern ? "an internship" : "the advertised position";
  const src = l.source === "referral" ? "" : sourcePhrase(l);

  const subject = email
    ? `Subject: Application for ${job || (intern ? "Internship" : "the advertised position")}${ref ? ` (Ref: ${ref})` : ""} – ${name}`
    : intern
      ? `Subject: Application for ${job ? (/\bintern\b/i.test(job) ? `the ${job} Position` : /\binternship\b/i.test(job) ? `the ${job}` : `the ${job} Internship`) : "an Internship"}${ref ? ` (Ref: ${ref})` : ""}`
      : `Subject: Application for the Position of ${job || "[Job Title]"}${ref ? ` (Ref: ${ref})` : ""}`;

  let salutation: string;
  if (manager) salutation = `Dear ${manager},`;
  else if (l.kind === "teaching") salutation = /principal/i.test(mTitle) ? "Dear Principal," : "Dear Sir/Madam,";
  else if (friendly) salutation = company ? `Dear ${company} Team,` : "Dear Hiring Team,";
  else if (intern) salutation = "Dear Hiring Team,";
  else salutation = "Dear Hiring Manager,";

  // 1 — opening
  const opener = {
    professional: [
      `I am writing to apply for ${rolePhrase} at ${co}${src}.`,
      `Please accept this letter as my application for ${rolePhrase} at ${co}${src}.`,
      `I would like to be considered for ${rolePhrase} at ${co}${src}.`,
    ],
    friendly: [
      `I was excited to come across ${rolePhrase} at ${co}${src} — it is exactly the kind of opportunity I have been hoping to find.`,
      `When I saw ${rolePhrase} at ${co}${src}, I knew straight away that I wanted to apply.`,
      `I'm delighted to apply for ${rolePhrase} at ${co}${src}.`,
    ],
    fresher: [
      `I am writing to apply for ${rolePhrase} at ${co}${src}.`,
      `I would like to apply for ${rolePhrase} at ${co}${src}.`,
      `Please consider my application for ${rolePhrase} at ${co}${src}.`,
    ],
    career: [
      `I am writing to express my interest in ${rolePhrase} at ${co}${src}.`,
      `I would like to apply for ${rolePhrase} at ${co}${src}. It is a move I have been preparing for with real commitment.`,
    ],
  }[tone];
  const opening = pick(s, 1, opener);
  const p1: string[] = [email ? opening.replace("accept this letter as my application", "accept this email as my application") : opening];
  if (l.source === "referral") {
    const who = t(l.sourceDetail);
    p1.push(
      friendly
        ? `${who || "A member of your team"} recommended I get in touch, and after learning more about the role I can see why.`
        : `${who || "A member of your team"} suggested I apply, and having learnt more about the role, I am confident it is a strong match for my skills.`,
    );
  }

  // background
  const as = bg ? withArticle(bg) : "";
  if (tone === "fresher" || intern) {
    const degree =
      /\b(bs|bsc|ba|ma|msc|ms|mba|bba|bcom|mcom|mbbs|bds|llb|be|bed|med|phd|mphil|degree|diploma|intermediate|fsc|fa|ics|icom|matric|o.?levels?|a.?levels?|university|college|graduat\w*|engineering|semester|student|studying)\b/i.test(bg);
    if (bg && !degree) {
      p1.push(`I have recently started my career as ${as}, and I am eager to grow with a team like yours.`);
    } else if (bg) {
      const studying = /\b(semester|year|student|studying|final)\b/i.test(bg);
      p1.push(
        studying
          ? pick(s, 2, [
              `I am currently studying ${bg}, and I am eager to put what I have learnt into practice.`,
              `As a student of ${bg}, I am keen to gain hands-on experience in a professional team.`,
            ])
          : pick(s, 2, [
              `I recently completed my ${bg}, and I am eager to begin my career with a team like yours.`,
              `Having recently completed my ${bg}, I am keen to put my learning into practice in a professional setting.`,
            ]),
      );
    } else p1.push("As a motivated recent graduate, I am eager to begin my career and to learn quickly on the job.");
  } else if (tone === "career") {
    if (bg || yrs)
      p1.push(
        pick(s, 2, [
          `After ${yrs ? `${yrs} as ` : "working as "}${as || "a professional in my current field"}, I am ready to take my experience in a new direction, and this role is exactly where I want to grow.`,
          yrs
            ? `I bring ${yrs} of experience${as ? ` as ${as}` : ""}, and many of the skills I built there carry over directly to this role.`
            : `I have worked as ${as}, and many of the skills I built there carry over directly to this role.`,
        ]),
      );
    else p1.push("Although my background is in a different field, the skills I have built carry over directly to this role.");
  } else if (friendly) {
    if (bg && yrs) p1.push(pick(s, 2, [`I've spent ${yrs} working as ${as}, and I'd love to bring that experience to your team.`, `For the past ${yrs} I've worked as ${as}, and I'm ready for my next challenge.`]));
    else if (bg) p1.push(`I currently work as ${as}, and I'd love to bring that experience to your team.`);
    else if (yrs) p1.push(`I bring ${yrs} of hands-on experience, and I'd love to put it to work for your team.`);
  } else {
    if (bg && yrs)
      p1.push(
        pick(s, 2, [
          `With ${yrs} of experience as ${as}, I have built the skills this role calls for.`,
          `I bring ${yrs} of experience as ${as}, and I am confident I can contribute from my first week.`,
          `Over ${yrs} as ${as}, I have developed the experience and judgement this position requires.`,
        ]),
      );
    else if (bg) p1.push(`As ${as}, I have developed the skills and experience this position calls for.`);
    else if (yrs) p1.push(`With ${yrs} of relevant experience, I am confident I can make a strong contribution to your team.`);
    else p1.push("I am confident that my skills and experience make me a strong fit for this role.");
  }

  // 2 — highlights
  const shown = email ? points.slice(0, 3) : points;
  let p2 = "";
  if (shown.length) {
    const intro = email
      ? pick(s, 3, ["Key highlights:", "A few highlights:"])
      : {
          professional: [`Highlights of what I would bring to ${co} include:`, "Some of the strengths I would bring to this role:", "A few examples of what I have achieved so far:"],
          friendly: ["A few things I'd bring to the team:", "Here's a quick snapshot of what I can offer:"],
          fresher: ["What I would bring to the team:", "Highlights from my studies and projects:"],
          career: ["Strengths from my career so far that transfer directly to this role:", "Skills that carry straight over to this position:"],
        }[tone];
    p2 = `${typeof intro === "string" ? intro : pick(s, 3, intro)}\n${shown.map((p) => `• ${p}`).join("\n")}`;
  }

  // 3 — fit: outro, field-specific sentence, why this company
  const p3: string[] = [];
  if (shown.length && !email) {
    const roleName = job || (intern ? "intern" : "new team member");
    p3.push(
      {
        professional: `I am confident these strengths would let me make a real contribution as your ${roleName}.`,
        friendly: "I'd bring the same energy and care to your team.",
        fresher: "I am a quick learner, and I would bring the same commitment and curiosity to your team.",
        career: "Combined with a fresh perspective, I believe these strengths would make me a valuable addition to your team.",
      }[tone],
    );
  }
  if (!email) {
    if (l.kind === "bank")
      p3.push(
        pick(s, 4, [
          "I understand how much accuracy, confidentiality and compliance matter in banking — including KYC and anti-money-laundering requirements — and I take pride in giving every customer courteous, error-free service.",
          "Banking is built on trust, so I bring the same care to compliance, cash handling and documentation as I do to building lasting customer relationships.",
        ]),
      );
    if (l.kind === "teaching")
      p3.push(
        pick(s, 4, [
          "I believe every student can succeed with patient, well-planned teaching, and I use interactive activities, regular assessment and open communication with parents to help each child reach their potential.",
          "My classroom is built on clear routines, engaging lessons and steady feedback, so students feel confident to ask questions and take part.",
        ]),
      );
    if (intern)
      p3.push(
        pick(s, 4, [
          "I am keen to learn from experienced professionals while contributing real work, and I am happy to take on whatever the team needs.",
          `An internship at ${co} would let me apply my classroom learning to real projects while learning how a professional team works.`,
        ]),
      );
  }
  if (why) {
    if (/^(i|i'm|i’m|i've|my|we|it|it's|this|having|as|since)\b/i.test(why)) p3.push(end(cap(why)));
    else
      p3.push(
        friendly
          ? `I'm especially excited about ${co} because of ${lc(why)}.`
          : pick(s, 5, [
              `What draws me to ${co} in particular is ${lc(why)}.`,
              `I am particularly drawn to ${co} because of ${lc(why)}.`,
              // only reads well when the reason is one simple phrase
              /[,;:—–-]/.test(why) ? `What draws me to ${co} in particular is ${lc(why)}.` : `${cap(why)} is a big part of why I would like to join ${co}.`,
            ]),
      );
  } else if (!email) {
    p3.push(
      {
        standard: friendly ? `I've followed ${co}'s work for a while, and I'd be proud to be part of it.` : `I am impressed by ${cos} reputation, and I would be proud to contribute to its continued success.`,
        bank: `${cap(cos)} reputation for customer service and sound financial practice is a big part of why I would like to join your team.`,
        teaching: `I admire ${cos} commitment to quality education, and I would be proud to contribute to your students' success.`,
        internship: `${cap(co)} is a place where I know I would learn a great deal, and I would be glad to contribute while I do.`,
        government: "",
      }[l.kind],
    );
  }

  // 4 — close
  const p4: string[] = [];
  if (avail) p4.push(availabilitySentence(avail, intern));
  if (email) {
    p4.push(
      friendly
        ? "I've attached my CV, and I'd love to chat about the role whenever suits you."
        : pick(s, 6, ["I have attached my CV for your review and would welcome the chance to discuss the role.", "Please find my CV attached. I would be glad to discuss how I can contribute to your team."]),
    );
    p4.push("Thank you for your time and consideration.");
  } else {
    p4.push(pick(s, 6, ["I have attached my CV for your review.", "My CV is enclosed with further details of my experience."]));
    p4.push(
      pick(
        s,
        7,
        {
          professional: [`Thank you for considering my application. I would welcome the opportunity to discuss how I can contribute to ${co}.`, "Thank you for your time and consideration. I would be glad to discuss my application with you at an interview."],
          friendly: [`Thanks so much for reading — I'd love to chat about how I could help ${co}.`, "Thank you for your time! I'd be delighted to talk more about the role whenever suits you."],
          fresher: ["Thank you for considering my application. I would be grateful for the opportunity to interview and to show you what I can do.", "Thank you for your time. I would welcome the chance to meet you and learn more about the role."],
          career: [`Thank you for considering my application. I would welcome the chance to explain how my background can bring a fresh perspective to ${co}.`, "Thank you for your time. I would be glad to discuss how my experience can support your team's goals."],
        }[tone],
      ),
    );
    if (contactLine) p4.push(friendly ? `You can reach me on ${contactLine}.` : `I can be reached on ${contactLine}.`);
  }

  const signOff = email ? (friendly ? "Kind regards," : "Best regards,") : friendly ? pick(s, 8, ["Kind regards,", "Warm regards,"]) : manager ? "Yours sincerely," : "Yours faithfully,";
  const sig = email ? [name, contact.join(" | "), t(l.linkedin)].filter(Boolean).join("\n") : name;

  const paras = [p1.join(" "), p2, p3.filter(Boolean).join(" "), p4.join(" ")].filter(Boolean);
  return { subject, body: [subject, "", salutation, "", paras.join("\n\n"), "", signOff, sig].join("\n") };
}

function availabilitySentence(avail: string, intern: boolean) {
  if (/^(i|my)\b/i.test(avail)) return end(cap(avail));
  if (/^(immediately|right away|from|after|on|within|in|by|before|starting|once)\b/i.test(avail)) return `I am available to ${intern ? "start" : "join"} ${avail}.`;
  if (/notice/i.test(avail)) return `I can join after ${avail}.`;
  return `I am available ${avail}.`;
}

/** Sender / date / recipient block that sits above the letter text. */
function headerParts(l: Letter) {
  const sender = [t(l.address), t(l.phone), t(l.email), t(l.linkedin)].filter(Boolean);
  const date = l.date ? formatDate(l.date) : "";
  let recipient: string[];
  if (l.kind === "government") {
    const title = t(l.managerTitle);
    const lines = ["To,"];
    if (t(l.manager)) lines.push(`${t(l.manager)},`);
    lines.push(title ? `${/^the\s/i.test(title) ? cap(title) : `The ${title}`},` : "The Competent Authority,");
    if (t(l.company)) lines.push(`${stripEnd(t(l.company)).replace(/,$/, "")},`);
    if (t(l.companyAddress)) lines.push(`${stripEnd(t(l.companyAddress))}.`);
    else if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, ".");
    recipient = lines;
  } else {
    recipient = [t(l.manager), t(l.managerTitle), t(l.company), t(l.companyAddress)].filter(Boolean);
  }
  return { sender, date, recipient };
}

function plainText(l: Letter, body: string) {
  if (l.format === "email") return body;
  const h = headerParts(l);
  const top =
    l.kind === "government"
      ? [h.date && `Date: ${h.date}`, "", ...h.recipient]
      : [t(l.name) || "Your Name", h.sender.join(" | "), "", h.date, h.recipient.length ? "" : null, ...h.recipient];
  return [...top.filter((x) => x !== null), "", body].join("\n").replace(/\n{3,}/g, "\n\n");
}

const isBullet = (line: string) => /^\s*[•\-*–·]\s+/.test(line);
const bulletText = (line: string) => line.replace(/^\s*[•\-*–·]\s+/, "");

/* ------------------------------------------------------------------ *
 * draft storage
 * ------------------------------------------------------------------ */

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

function readDraft(): Letter | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Record<string, unknown>;
    if (!r || typeof r !== "object") return null;
    const pts = Array.isArray(r.points) ? r.points : [];
    return {
      kind: oneOf(r.kind, KINDS.map((k) => k.id), "standard"),
      tone: oneOf(r.tone, TONES.map((k) => k.id), "professional"),
      format: oneOf(r.format, ["letter", "email"] as const, "letter"),
      seed: typeof r.seed === "number" && Number.isFinite(r.seed) ? Math.abs(Math.floor(r.seed)) % 1000 : 0,
      name: str(r.name),
      email: str(r.email),
      phone: str(r.phone),
      address: str(r.address),
      linkedin: str(r.linkedin),
      cnic: str(r.cnic),
      manager: str(r.manager),
      managerTitle: str(r.managerTitle),
      company: str(r.company),
      companyAddress: str(r.companyAddress),
      job: str(r.job),
      source: oneOf(r.source, SOURCES.map((x) => x.id), ""),
      sourceDetail: str(r.sourceDetail),
      refNo: str(r.refNo),
      background: str(r.background),
      years: str(r.years),
      points: [str(pts[0]), str(pts[1]), str(pts[2])],
      why: str(r.why),
      availability: str(r.availability),
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : "",
      text: typeof r.text === "string" ? r.text.slice(0, 20_000) : null,
    };
  } catch {
    return null;
  }
}

function writeDraft(l: Letter) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
    return true;
  } catch {
    return false;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}

type CvDetails = { name: string; email: string; phone: string; address: string; linkedin: string; background: string };

/** Contact details from the CV Maker's saved draft, if there is one. */
function readCvDetails(): CvDetails | null {
  try {
    const raw = localStorage.getItem(CV_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Record<string, unknown>;
    const p = (r?.personal ?? {}) as Record<string, unknown>;
    const exp = Array.isArray(r?.experience) ? (r.experience as Record<string, unknown>[]) : [];
    const d: CvDetails = {
      name: str(p.name, 120),
      email: str(p.email, 120),
      phone: str(p.phone, 60),
      address: str(p.location, 160),
      linkedin: str(p.linkedin, 160),
      background: str(exp[0]?.title, 120) || str(p.headline, 120),
    };
    return d.name || d.email || d.phone ? d : null;
  } catch {
    return null;
  }
}

/** Fill only the empty fields. */
function mergeCv(l: Letter, cv: CvDetails): Letter {
  return {
    ...l,
    name: l.name || cv.name,
    email: l.email || cv.email,
    phone: l.phone || cv.phone,
    address: l.address || cv.address,
    linkedin: l.linkedin || cv.linkedin,
    background: l.background || cv.background,
  };
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

/* ------------------------------------------------------------------ *
 * PDF — A4 letter, Helvetica, wrapped text with page breaks
 * ------------------------------------------------------------------ */

async function buildLetterPdf(l: Letter, body: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const name = t(l.name);
  doc.setTitle(name ? `${name} — ${l.kind === "government" ? "Application" : "Cover letter"}` : "Cover letter");
  if (name) doc.setAuthor(name);
  doc.setCreator("SnapGrab Cover Letter Generator");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 64; // ~22.5 mm
  const CW = W - 2 * M;
  const SIZE = 11;
  const LH = 15.5;
  const ink = rgb(0.08, 0.08, 0.1);
  const muted = rgb(0.38, 0.38, 0.42);

  let page = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (h: number) => {
    if (y - h < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const draw = (s: string, x: number, size = SIZE, f: PDFFont = font, color = ink) => {
    const safe = pdfSafe(s);
    if (safe) page.drawText(safe, { x, y, size, font: f, color });
  };
  const line = (s: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; lh?: number; indent?: number; right?: boolean } = {}) => {
    const size = opts.size ?? SIZE;
    const f = opts.f ?? font;
    const lh = opts.lh ?? LH;
    const indent = opts.indent ?? 0;
    for (const l2 of wrap(s, f, size, CW - indent)) {
      ensure(lh);
      y -= lh;
      const x = opts.right ? M + CW - f.widthOfTextAtSize(l2, size) : M + indent;
      draw(l2, x, size, f, opts.color ?? ink);
    }
  };
  const gap = (h = LH * 0.7) => {
    y -= h;
  };

  const h = headerParts(l);
  if (l.format === "letter" && l.kind === "government") {
    if (h.date) line(`Date: ${h.date}`, { right: true });
    gap(LH * 0.4);
    for (const r of h.recipient) line(r);
    gap();
  } else if (l.format === "letter") {
    line(name || "Your Name", { size: 17, f: bold, lh: 21 });
    if (h.sender.length) line(h.sender.join("  |  "), { size: 9.5, color: muted, lh: 13 });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.8, color: ink });
    gap(LH * 0.6);
    if (h.date) line(h.date);
    if (h.recipient.length) {
      gap();
      for (const r of h.recipient) line(r);
    }
    gap();
  }

  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  for (const raw of lines) {
    const s = raw.trimEnd();
    if (!s.trim()) {
      gap();
      continue;
    }
    if (/^subject\s*:/i.test(s)) line(s, { f: bold });
    else if (isBullet(s)) {
      const parts = wrap(bulletText(s), font, SIZE, CW - 16);
      parts.forEach((p, i) => {
        ensure(LH);
        y -= LH;
        if (i === 0) draw("•", M + 3);
        draw(p, M + 16);
      });
    } else line(s);
  }

  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((pg, i) => {
      const label = pdfSafe(`${name ? `${name} — ` : ""}Page ${i + 1} of ${pages.length}`);
      pg.drawText(label, { x: M + CW - font.widthOfTextAtSize(label, 8), y: M / 2 - 4, size: 8, font, color: muted });
    });
  }
  return doc.save();
}

/* ------------------------------------------------------------------ *
 * small UI pieces
 * ------------------------------------------------------------------ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  required,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "email" | "tel" | "url" | "text" | "numeric";
  autoComplete?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="text-red-400"> *</span>}
        {hint && <span className="font-normal text-muted"> ({hint})</span>}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        maxLength={600}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`${field} ${error ? "border-red-500/60" : ""}`}
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-2xl surface p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; hint?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          title={o.hint}
          onClick={() => onChange(o.id)}
          className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
            value === o.id ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Renders the letter text: bold subject line, hanging-indent bullets, paragraph gaps. */
function BodyText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((raw, i) => {
        const s = raw.trimEnd();
        if (!s.trim()) return <div key={i} className="h-[0.7em]" aria-hidden />;
        if (/^subject\s*:/i.test(s))
          return (
            <p key={i} className="break-words font-bold">
              {s}
            </p>
          );
        if (isBullet(s))
          return (
            <p key={i} className="flex gap-2 break-words pl-1">
              <span aria-hidden>•</span>
              <span className="min-w-0">{bulletText(s)}</span>
            </p>
          );
        return (
          <p key={i} className="break-words">
            {s}
          </p>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * component
 * ------------------------------------------------------------------ */

export default function CoverLetterStudio({ tool }: { tool: Tool }) {
  const [l, setL] = useState<Letter>(() => blankLetter());
  const [ready, setReady] = useState(false);
  const [cv, setCv] = useState<CvDetails | null>(null);
  const [view, setView] = useState<"preview" | "edit">("preview");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // after mount: restore the draft (or prefill from the CV Maker) and set today's date
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const draft = readDraft();
      const cvd = readCvDetails();
      setCv(cvd);
      let next = draft ?? blankLetter();
      if (!draft && cvd) {
        next = mergeCv(next, cvd);
        notify.info("Details filled from your CV", "We used the name and contact details saved in the CV Maker on this device.");
      }
      if (!next.date) next = { ...next, date: todayIso() };
      setL(next);
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      if (!writeDraft(l)) return;
      const now = new Date();
      setSavedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [l, ready]);

  const generated = useMemo(() => compose(l), [l]);
  const body = l.text ?? generated.body;
  const edited = l.text !== null;
  const words = body.split(/\s+/).filter(Boolean).length;

  const set = <K extends keyof Letter>(key: K, value: Letter[K]) => setL((p) => ({ ...p, [key]: value }));
  const setPoint = (i: number, v: string) =>
    setL((p) => {
      const points = [...p.points] as Letter["points"];
      points[i] = v;
      return { ...p, points };
    });

  const nameError = showErrors && !t(l.name) ? "Add your full name — it signs the letter." : undefined;
  const jobError = showErrors && !t(l.job) ? "Add the job title or post you are applying for." : undefined;
  const sourceSpec = SOURCES.find((x) => x.id === l.source);
  const gov = l.kind === "government";
  const student = l.kind === "internship" || l.tone === "fresher";

  function regenerate() {
    if (edited && !window.confirm("Replace your edited letter with a fresh one built from the form?")) return;
    setL((p) => ({ ...p, text: null }));
  }

  function shuffle() {
    if (edited && !window.confirm("New wording replaces your hand edits. Continue?")) return;
    setL((p) => ({ ...p, seed: (p.seed + 1) % 1000, text: null }));
    trackEvent("shuffle", tool.slug);
  }

  function loadSample() {
    if ((edited || t(l.company) || t(l.job)) && !window.confirm("Replace the form with a sample letter?")) return;
    setL((p) => sampleLetter(p));
    setShowErrors(false);
    trackEvent("sample", tool.slug);
    notify.info("Sample loaded", "Swap in your own details — the letter rewrites itself as you type.");
  }

  function clearAll() {
    if (!window.confirm("Clear the whole form and the saved draft?")) return;
    setL((p) => ({ ...blankLetter(p.kind, p.tone, p.format), date: todayIso() }));
    clearDraft();
    setShowErrors(false);
    trackEvent("reset", tool.slug);
  }

  function fillFromCv() {
    const d = readCvDetails();
    if (!d) return notify.info("No saved CV found", "Build your CV in the CV Maker first — it saves on this device.");
    setL((p) => mergeCv(p, d));
    notify.success("Filled from your CV", "Only the empty fields were filled.");
  }

  const validate = () => {
    setShowErrors(true);
    if (!t(l.name)) {
      notify.error("Your name is missing", "Add your full name in “Your details”.");
      return false;
    }
    return true;
  };

  const fileBase = `${slugify(t(l.name)) || "my"}-${gov ? "application" : "cover-letter"}`;

  async function download() {
    if (busy || !validate()) return;
    setBusy(true);
    try {
      const bytes = await buildLetterPdf(l, body);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
      trackEvent("download", tool.slug);
      fetch("/api/tools/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ tool: tool.slug, outputType: "application/pdf", files: 1, bytesOut: blob.size }),
      }).catch(() => {});
      notify.success("PDF downloaded", `${fileBase}.pdf`);
    } catch (err) {
      notify.error("Could not build the PDF", err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    const text = plainText(l, body);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    trackEvent("copy", tool.slug);
    setCopied(true);
    notify.success(l.format === "email" ? "Email copied" : "Letter copied", "Paste it into your email, Word or a job portal.");
    window.setTimeout(() => setCopied(false), 1600);
  }

  function openEmail() {
    if (!validate()) return;
    const lines = body.split("\n");
    let subject = "";
    if (/^subject\s*:/i.test(lines[0] ?? "")) {
      subject = lines[0].replace(/^subject\s*:\s*/i, "");
      lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
    }
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    trackEvent("email", tool.slug);
    window.location.href = href.slice(0, 7500);
  }

  const header = headerParts(l);

  return (
    <div id="tool" className="scroll-mt-24">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="aurora-border rounded-[26px]">
        <div className="glass @container rounded-[26px] p-4 sm:p-6">
          {/* type, tone, format */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 @lg:grid-cols-5" role="radiogroup" aria-label="Letter type">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={l.kind === k.id}
                  onClick={() => setL((p) => ({ ...p, kind: k.id, tone: k.id === "internship" && p.tone === "professional" ? "fresher" : p.tone }))}
                  className={`rounded-xl px-3 py-2 text-left transition-all ${
                    l.kind === k.id ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25" : "surface text-muted hover:text-[var(--fg)]"
                  }`}
                >
                  <span className="block text-sm font-bold">{k.label}</span>
                  <span className={`block truncate text-[11px] ${l.kind === k.id ? "text-white/80" : "text-muted"}`}>{k.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {gov ? (
                <p className="text-xs text-muted">Government applications use the traditional formal format (To, Subject, Respected Sir/Madam).</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Tone</span>
                  <Chips label="Tone" value={l.tone} options={TONES} onChange={(v) => set("tone", v)} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Format</span>
                <Chips
                  label="Format"
                  value={l.format}
                  options={[
                    { id: "letter", label: "Letter" },
                    { id: "email", label: "Short email" },
                  ]}
                  onChange={(v) => set("format", v)}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-6 @4xl:grid-cols-2">
            {/* =========================== FORM =========================== */}
            <div className="@container min-w-0 space-y-4">
              <Section title="Your details">
                <Field label="Full name" required value={l.name} onChange={(v) => set("name", v)} placeholder="Ayesha Khan" autoComplete="name" error={nameError} />
                <div className="grid gap-3 @md:grid-cols-2">
                  <Field label="Email" type="email" inputMode="email" autoComplete="email" value={l.email} onChange={(v) => set("email", v)} placeholder="you@email.com" />
                  <Field label="Phone" type="tel" inputMode="tel" autoComplete="tel" value={l.phone} onChange={(v) => set("phone", v)} placeholder="+92 300 1234567" />
                </div>
                <Field label="Address / city" value={l.address} onChange={(v) => set("address", v)} placeholder="Model Town, Lahore" autoComplete="street-address" />
                <div className="grid gap-3 @md:grid-cols-2">
                  {!gov && <Field label="LinkedIn" inputMode="url" value={l.linkedin} onChange={(v) => set("linkedin", v)} placeholder="linkedin.com/in/you" />}
                  {gov && <Field label="CNIC" inputMode="numeric" value={l.cnic} onChange={(v) => set("cnic", v)} placeholder="35202-1234567-8" />}
                </div>
                {cv && (
                  <button type="button" onClick={fillFromCv} className="flex items-center gap-2 text-xs font-bold text-brand-400 hover:underline">
                    <UserRound className="h-3.5 w-3.5" /> Fill empty fields from my saved CV
                  </button>
                )}
              </Section>

              <Section title={gov ? "Addressed to" : "Employer"}>
                <div className="grid gap-3 @md:grid-cols-2">
                  <Field label={gov ? "Officer's name" : "Hiring manager"} hint="optional" value={l.manager} onChange={(v) => set("manager", v)} placeholder={gov ? "" : "Mr. Usman Tariq"} />
                  <Field label={gov ? "Designation" : "Their title"} value={l.managerTitle} onChange={(v) => set("managerTitle", v)} placeholder={gov ? "Secretary / Director General" : "HR Manager"} />
                </div>
                <div className="grid gap-3 @md:grid-cols-2">
                  <Field label={gov ? "Department / organisation" : "Company / school"} value={l.company} onChange={(v) => set("company", v)} placeholder={gov ? "Punjab Public Service Commission" : "Company name"} />
                  <Field label="City / address" value={l.companyAddress} onChange={(v) => set("companyAddress", v)} placeholder="Lahore" />
                </div>
              </Section>

              <Section title="The job">
                <Field label={gov ? "Post applied for" : "Job title"} required value={l.job} onChange={(v) => set("job", v)} placeholder={gov ? "Assistant (BPS-16)" : "Relationship Manager"} error={jobError} />
                <div className="grid gap-3 @md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Where you saw it</span>
                    <select value={l.source} onChange={(e) => set("source", e.target.value as Source)} className={field}>
                      {SOURCES.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field label={gov ? "Advertisement no." : "Reference no."} hint="optional" value={l.refNo} onChange={(v) => set("refNo", v)} placeholder={gov ? "24/2026" : "HR-1024"} />
                </div>
                {sourceSpec?.detail && <Field label={sourceSpec.detail} value={l.sourceDetail} onChange={(v) => set("sourceDetail", v)} placeholder={sourceSpec.placeholder} />}
              </Section>

              <Section title="About you">
                <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_9rem]">
                  <Field
                    label={gov ? "Qualification" : student ? "Degree / what you study" : l.tone === "career" ? "Current or previous field / job" : "Current or last job title"}
                    value={l.background}
                    onChange={(v) => set("background", v)}
                    placeholder={gov ? "BS Commerce, University of the Punjab" : student ? "BS Computer Science at FAST" : "Personal Banking Officer"}
                  />
                  {!student && <Field label={gov ? "Experience" : "Years of experience"} inputMode="text" value={l.years} onChange={(v) => set("years", v)} placeholder={gov ? "2 years" : "3"} />}
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-semibold">
                    Key achievements or skills <span className="font-normal text-muted">(2–3, short — numbers help)</span>
                  </span>
                  {l.points.map((p, i) => (
                    <input
                      key={i}
                      value={p}
                      maxLength={300}
                      onChange={(e) => setPoint(i, e.target.value)}
                      aria-label={`Achievement or skill ${i + 1}`}
                      placeholder={
                        [
                          student ? "Built a final-year project used by 300+ students" : "Grew branch deposits by 25% in one year",
                          student ? "Top 10% of my class (CGPA 3.7)" : "Handled 60+ customers a day with zero cash differences",
                          "Fluent in English and Urdu; advanced MS Excel",
                        ][i]
                      }
                      className={field}
                    />
                  ))}
                </div>
                {!gov && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">
                      Why this company? <span className="font-normal text-muted">(finish the sentence “I am drawn to them because of …”)</span>
                    </span>
                    <textarea
                      rows={2}
                      value={l.why}
                      maxLength={400}
                      onChange={(e) => set("why", e.target.value)}
                      placeholder="your focus on digital banking and your reputation for training young staff"
                      className={`${field} resize-y`}
                    />
                  </label>
                )}
                <div>
                  <Field label={l.kind === "internship" ? "Availability" : "Availability / notice period"} value={l.availability} onChange={(v) => set("availability", v)} placeholder="after one month's notice" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(l.kind === "internship" ? AVAILABILITY.internship : AVAILABILITY.job).map((a) => (
                      <button key={a} type="button" onClick={() => set("availability", a)} className="rounded-lg surface px-2.5 py-1 text-xs font-semibold text-muted hover:text-[var(--fg)]">
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                {l.format === "letter" && <Field label="Date on the letter" type="date" value={l.date} onChange={(v) => set("date", v)} />}
              </Section>
            </div>

            {/* =========================== RESULT =========================== */}
            <div className="min-w-0 @4xl:sticky @4xl:top-24 @4xl:max-h-[calc(100vh-7rem)] @4xl:self-start @4xl:overflow-y-auto">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl surface p-1" role="tablist" aria-label="Result view">
                  {(
                    [
                      ["preview", "Preview", Eye],
                      ["edit", "Edit text", PenLine],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={view === id}
                      onClick={() => setView(id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${view === id ? "bg-brand-500 text-white" : "text-muted hover:text-[var(--fg)]"}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={shuffle} className="flex items-center gap-1.5 rounded-xl surface px-3 py-2 text-xs font-bold hover:border-brand-400/60" title="Rewrite with different sentence variations">
                  <Shuffle className="h-3.5 w-3.5" /> New wording
                </button>
                <span className="ml-auto text-xs text-muted">{words} words</span>
              </div>

              {edited && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <span className="flex-1">You edited the text by hand, so form changes are not applied to it.</span>
                  <button type="button" onClick={regenerate} className="flex items-center gap-1 font-bold underline">
                    <RefreshCw className="h-3.5 w-3.5" /> Rebuild from form
                  </button>
                </div>
              )}

              {view === "edit" ? (
                <textarea
                  value={body}
                  onChange={(e) => set("text", e.target.value.slice(0, 20_000))}
                  rows={26}
                  aria-label="Letter text"
                  spellCheck
                  className={`${field} min-h-[480px] resize-y font-mono text-[13px] leading-relaxed`}
                />
              ) : (
                <div className="rounded-2xl bg-white px-6 py-7 text-[11.5px] leading-[1.55] text-zinc-900 shadow-xl sm:px-9 sm:text-[12.5px]" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
                  {l.format === "letter" && gov && (
                    <>
                      {header.date && <p className="text-right">Date: {header.date}</p>}
                      <div className="mt-2">
                        {header.recipient.map((r, i) => (
                          <p key={i} className="break-words">
                            {r}
                          </p>
                        ))}
                      </div>
                      <div className="h-[0.7em]" />
                    </>
                  )}
                  {l.format === "letter" && !gov && (
                    <>
                      <p className="break-words text-lg font-bold leading-tight sm:text-xl">{t(l.name) || "Your Name"}</p>
                      {header.sender.length > 0 && <p className="mt-0.5 break-words text-[10.5px] text-zinc-500">{header.sender.join("  |  ")}</p>}
                      <div className="mb-3 mt-2 border-b border-zinc-800" />
                      {header.date && <p>{header.date}</p>}
                      {header.recipient.length > 0 && (
                        <div className="mt-3">
                          {header.recipient.map((r, i) => (
                            <p key={i} className="break-words">
                              {r}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="h-[0.7em]" />
                    </>
                  )}
                  {l.format === "email" && <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Email — paste into Gmail or Outlook and attach your CV</p>}
                  <BodyText text={body} />
                </div>
              )}
            </div>
          </div>

          {/* actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={() => void download()}
              disabled={busy}
              aria-busy={busy}
              whileHover={{ scale: busy ? 1 : 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 disabled:opacity-50 sm:min-w-[210px] sm:flex-none"
            >
              {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Download className="h-[18px] w-[18px]" />}
              {busy ? "Building PDF…" : "Download PDF"}
            </motion.button>
            <button type="button" onClick={() => void copyText()} className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60">
              {copied ? <Check className="h-[18px] w-[18px] text-accent-400" /> : <Copy className="h-[18px] w-[18px]" />} Copy text
            </button>
            {l.format === "email" && (
              <button type="button" onClick={openEmail} className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60">
                <Mail className="h-[18px] w-[18px]" /> Open in email app
              </button>
            )}
            <ShareSheet
              title={gov ? "My job application" : "My cover letter"}
              text="Made with the free Cover Letter Generator on SnapGrab"
              getFiles={async () => {
                const bytes = await buildLetterPdf(l, body);
                return [new File([bytes as BlobPart], `${fileBase}.pdf`, { type: "application/pdf" })];
              }}
            />
            <button type="button" onClick={loadSample} className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold transition-colors hover:border-brand-400/60">
              <Sparkles className="h-[18px] w-[18px] text-brand-400" /> Load sample
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-2 rounded-2xl surface px-5 py-3.5 font-bold text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              <Eraser className="h-[18px] w-[18px]" /> Clear all
            </button>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent-400" />
            <span>
              No AI and no upload — the letter is assembled in your browser from carefully written templates, and your draft auto-saves on this device
              {savedAt ? ` (last saved ${savedAt})` : ""}. Read it through and make it yours before sending. The PDF uses standard fonts, so Urdu script is
              replaced.
            </span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

import { renderMarkdown } from "@/lib/markdown";
import { Reveal } from "./motion";
import { Aurora } from "./sections";

export default function LegalPage({
  title,
  updated,
  intro,
  body,
}: {
  title: string;
  updated: string;
  intro: string;
  body: string;
}) {
  return (
    <>
      <section className="relative overflow-hidden px-4 pb-8 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Last updated {updated}</span>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-lg">{intro}</p>
          </Reveal>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl">
          <div className="prose-article rounded-[26px] surface p-6 sm:p-9" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
        </Reveal>
      </section>
    </>
  );
}

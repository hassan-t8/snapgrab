import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";
import { Aurora, SectionHead } from "@/components/sections";
import AdSlot from "@/components/AdSlot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — Guides, tips and honest answers",
  description:
    "Practical guides on downloading video and audio from social platforms, choosing formats, and staying on the right side of copyright.",
  alternates: { canonical: "/blog" },
};

function readingTime(content: string) {
  return Math.max(1, Math.round(content.split(/\s+/).length / 220));
}

export default async function BlogIndex() {
  const posts = await prisma.blogPost
    .findMany({ where: { published: true }, orderBy: { createdAt: "desc" } })
    .catch(() => []);

  const [featured, ...rest] = posts;

  return (
    <>
      <section className="relative overflow-hidden px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <Aurora />
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-300">
              <BookOpen className="h-3.5 w-3.5" /> The SnapGrab blog
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Guides worth <span className="gradient-text">actually reading</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Format explainers, platform walkthroughs and plain-English answers about what you may and may not keep.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {posts.length === 0 ? (
            <p className="py-20 text-center text-muted">No posts published yet — check back soon.</p>
          ) : (
            <>
              {featured && (
                <Reveal>
                  <Link href={`/blog/${featured.slug}`} className="group block">
                    <article className="grid overflow-hidden rounded-[26px] surface transition-all hover:-translate-y-1 hover:border-brand-400/40 lg:grid-cols-2">
                      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg-soft)] lg:aspect-auto lg:min-h-[320px]">
                        {featured.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={featured.cover}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                        <span className="absolute left-4 top-4 rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-bold text-white">
                          Featured
                        </span>
                      </div>
                      <div className="flex flex-col justify-center p-7 sm:p-9">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{format(featured.createdAt, "d MMM yyyy")}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {readingTime(featured.content)} min read
                          </span>
                        </div>
                        <h2 className="mt-3 text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
                          {featured.title}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-muted">{featured.excerpt}</p>
                        <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-400">
                          Read the guide
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </article>
                  </Link>
                </Reveal>
              )}

              <div className="my-10">
                <AdSlot className="h-[90px]" />
              </div>

              <StaggerGroup className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <StaggerItem key={p.id}>
                    <Link href={`/blog/${p.slug}`} className="group block h-full">
                      <article className="flex h-full flex-col overflow-hidden rounded-2xl surface transition-all hover:-translate-y-1.5 hover:border-brand-400/40">
                        <div className="relative aspect-[16/9] overflow-hidden bg-[var(--bg-soft)]">
                          {p.cover && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.cover}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <div className="flex flex-wrap gap-1.5">
                            {p.tags
                              .split(",")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md bg-brand-500/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-400"
                                >
                                  {t.trim()}
                                </span>
                              ))}
                          </div>
                          <h3 className="mt-3 line-clamp-2 font-bold leading-snug">{p.title}</h3>
                          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">{p.excerpt}</p>
                          <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs text-muted">
                            <span>{format(p.createdAt, "d MMM yyyy")}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {readingTime(p.content)} min
                            </span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </>
          )}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHead title="Need a tool, not an article?" sub="The downloader is one click away." />
          <div className="mt-6 text-center">
            <Link
              href="/#downloader"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-7 py-3.5 font-bold text-white shadow-xl shadow-brand-500/25 transition-transform hover:scale-105"
            >
              Open the downloader <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

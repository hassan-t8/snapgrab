import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Clock, Eye, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { Reveal } from "@/components/motion";
import AdSlot from "@/components/AdSlot";
import ShareRow from "@/components/ShareRow";
import { breadcrumbJsonLd, jsonLd, ogImage, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } }).catch(() => null);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.createdAt.toISOString(),
      images: [post.cover ?? ogImage({ title: post.title, subtitle: post.excerpt, badge: "SnapGrab blog" })],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.cover ?? ogImage({ title: post.title, subtitle: post.excerpt, badge: "SnapGrab blog" })],
    },
  };
}

export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } }).catch(() => null);
  if (!post || !post.published) notFound();

  await prisma.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const related = await prisma.blogPost
    .findMany({ where: { published: true, NOT: { id: post.id } }, take: 3, orderBy: { createdAt: "desc" } })
    .catch(() => []);

  const minutes = Math.max(1, Math.round(post.content.split(/\s+/).length / 220));
  const html = renderMarkdown(post.content);

  return (
    <article className="px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-400">
            <ArrowLeft className="h-4 w-4" /> All articles
          </Link>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-6 flex flex-wrap gap-2">
            {post.tags
              .split(",")
              .filter(Boolean)
              .map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-brand-500/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-400"
                >
                  {t.trim()}
                </span>
              ))}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-[2.6rem]">{post.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{post.excerpt}</p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--line)] py-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" /> {post.author}
            </span>
            <span>{format(post.createdAt, "d MMMM yyyy")}</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {minutes} min read
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> {post.views.toLocaleString()} views
            </span>
          </div>
        </Reveal>

        {post.cover && (
          <Reveal delay={0.1}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover} alt="" className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover" />
          </Reveal>
        )}

        <Reveal delay={0.12}>
          <div className="prose-article mt-8" dangerouslySetInnerHTML={{ __html: html }} />
        </Reveal>

        <div className="my-10">
          <AdSlot className="h-[90px]" />
        </div>

        <ShareRow title={post.title} slug={post.slug} />

        <Reveal>
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 p-7 text-center text-white">
            <h2 className="text-xl font-extrabold">Try it while it is fresh</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
              Paste any link into the downloader and see the formats for yourself.
            </p>
            <Link
              href="/#downloader"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 transition-transform hover:scale-105"
            >
              Open downloader <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-extrabold tracking-tight">Keep reading</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${r.slug}`}
                  className="group rounded-2xl surface p-4 transition-all hover:-translate-y-1 hover:border-brand-400/40"
                >
                  <h3 className="line-clamp-3 text-sm font-bold leading-snug">{r.title}</h3>
                  <p className="mt-2 text-xs text-muted">{format(r.createdAt, "d MMM yyyy")}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            image: post.cover ?? undefined,
            wordCount: post.content.split(/\s+/).length,
            author: { "@type": "Organization", name: post.author },
            publisher: { "@type": "Organization", name: "SnapGrab", url: siteUrl() },
            mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl()}/blog/${post.slug}` },
            datePublished: post.createdAt.toISOString(),
            dateModified: post.updatedAt.toISOString(),
          },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        )}
      />
    </article>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, Loader2, Save } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";

export type PostDraft = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover: string;
  tags: string;
  author: string;
  published: boolean;
};

const EMPTY: PostDraft = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover: "",
  tags: "",
  author: "SnapGrab Team",
  published: true,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default function PostEditor({ initial }: { initial?: PostDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PostDraft>(initial ?? EMPTY);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const set = <K extends keyof PostDraft>(k: K, v: PostDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/admin/blogs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not save the post.");
      setState("saved");
      router.refresh();
      if (!draft.id) router.push(`/admin/blogs/${json.data.id}`);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  const field =
    "w-full rounded-xl surface px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted focus:border-brand-400";

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/blogs" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-400">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="flex items-center gap-1.5 rounded-xl surface px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-400/60"
          >
            <Eye className="h-4 w-4" /> {preview ? "Edit" : "Preview"}
          </button>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.96 }}
            disabled={state === "saving"}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-brand-500/25 disabled:opacity-60"
          >
            {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {draft.id ? "Save changes" : "Publish post"}
          </motion.button>
        </div>
      </div>

      {state === "saved" && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-2.5 text-sm text-accent-400"
        >
          <CheckCircle2 className="h-4 w-4" /> Saved.
        </motion.p>
      )}
      {state === "error" && (
        <p className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4 rounded-2xl surface p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Title</span>
            <input
              required
              value={draft.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!draft.id && !draft.slug) set("slug", slugify(e.target.value));
              }}
              onBlur={() => !draft.slug && set("slug", slugify(draft.title))}
              className={field}
              placeholder="How to download YouTube videos in 4K"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Slug</span>
            <input
              required
              value={draft.slug}
              onChange={(e) => set("slug", slugify(e.target.value))}
              className={`${field} font-mono`}
              placeholder="how-to-download-youtube-videos"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Excerpt</span>
            <textarea
              required
              rows={3}
              value={draft.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              className={`${field} resize-y`}
              placeholder="One or two sentences used on the blog index and in search results."
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-semibold">
              Content
              <span className="text-xs font-normal text-muted">Markdown: ## heading, **bold**, - list, &gt; quote</span>
            </span>
            {preview ? (
              <div
                className="prose-article min-h-[320px] rounded-xl surface p-4"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content || "_Nothing to preview yet._") }}
              />
            ) : (
              <textarea
                required
                rows={18}
                value={draft.content}
                onChange={(e) => set("content", e.target.value)}
                className={`${field} resize-y font-mono text-[13px] leading-relaxed`}
                placeholder={"## Why this matters\n\nWrite the article here."}
              />
            )}
          </label>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl surface p-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Cover image URL</span>
              <input value={draft.cover} onChange={(e) => set("cover", e.target.value)} className={field} placeholder="https://…" />
            </label>
            {draft.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.cover} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Tags</span>
              <input
                value={draft.tags}
                onChange={(e) => set("tags", e.target.value)}
                className={field}
                placeholder="youtube,guide,4k"
              />
              <span className="mt-1 block text-xs text-muted">Comma separated.</span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Author</span>
              <input value={draft.author} onChange={(e) => set("author", e.target.value)} className={field} />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[var(--bg-soft)] px-4 py-3">
              <span>
                <span className="block text-sm font-semibold">Published</span>
                <span className="block text-xs text-muted">Drafts stay hidden from the public blog.</span>
              </span>
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => set("published", e.target.checked)}
                className="h-5 w-5 accent-[var(--color-brand-500)]"
              />
            </label>
          </div>
        </div>
      </div>
    </form>
  );
}

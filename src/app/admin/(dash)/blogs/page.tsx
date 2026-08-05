import Link from "next/link";
import { format } from "date-fns";
import { Eye, FileText, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge, EmptyRow, Panel, StatCard } from "@/components/admin/ui";
import DeletePostButton from "@/components/admin/DeletePostButton";

export const dynamic = "force-dynamic";

export default async function AdminBlogs() {
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  const published = posts.filter((p) => p.published).length;
  const views = posts.reduce((n, p) => n + p.views, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total posts" value={posts.length} icon={<FileText />} />
        <StatCard label="Published" value={published} icon={<FileText />} tone="accent" delay={0.05} />
        <StatCard label="Total views" value={views.toLocaleString()} icon={<Eye />} tone="amber" delay={0.1} />
      </div>

      <Panel
        title="All posts"
        action={
          <Link
            href="/admin/blogs/new"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 px-3 py-1.5 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> New post
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">Title</th>
                <th className="px-5 py-3 font-semibold">Tags</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Views</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 && <EmptyRow colSpan={6} message="No posts yet — create your first one." />}
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-[var(--line)] last:border-0 hover:bg-brand-500/5">
                  <td className="max-w-[320px] px-5 py-3">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="truncate font-mono text-xs text-muted">/blog/{p.slug}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{p.tags || "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={p.published ? "ok" : "warn"}>{p.published ? "published" : "draft"}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{p.views.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">{format(p.createdAt, "d MMM yyyy")}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3 text-xs font-bold">
                      <Link href={`/blog/${p.slug}`} target="_blank" className="text-muted hover:text-brand-400">
                        View
                      </Link>
                      <Link href={`/admin/blogs/${p.id}`} className="text-brand-400 hover:underline">
                        Edit
                      </Link>
                      <DeletePostButton id={p.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

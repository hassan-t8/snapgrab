import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public JSON feed of published posts — consumed by the mobile app. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 20) || 20));
  const slug = params.get("slug");

  try {
    if (slug) {
      const post = await prisma.blogPost.findUnique({ where: { slug } });
      if (!post || !post.published) {
        return NextResponse.json({ ok: false, error: "Post not found." }, { status: 404 });
      }
      await prisma.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {});
      return NextResponse.json({
        ok: true,
        data: {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          cover: post.cover,
          tags: post.tags.split(",").map((t) => t.trim()).filter(Boolean),
          author: post.author,
          views: post.views,
          readingMinutes: Math.max(1, Math.round(post.content.split(/\s+/).length / 220)),
          createdAt: post.createdAt.toISOString(),
        },
      });
    }

    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        cover: true,
        tags: true,
        author: true,
        createdAt: true,
        content: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: posts.map(({ content, ...p }) => ({
        ...p,
        tags: p.tags.split(",").map((t) => t.trim()).filter(Boolean),
        // the client cannot work this out without the body, so send it with the summary
        readingMinutes: Math.max(1, Math.round(content.split(/\s+/).length / 220)),
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load posts." }, { status: 500 });
  }
}

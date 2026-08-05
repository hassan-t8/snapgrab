import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBody = z.object({
  id: z.string().optional(),
  title: z.string().min(3).max(160),
  slug: z.string().min(3).max(160).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
  excerpt: z.string().min(10).max(400),
  content: z.string().min(20),
  cover: z.string().optional().or(z.literal("")),
  tags: z.string().max(200).optional(),
  author: z.string().max(80).optional(),
  published: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { id, ...data } = parsed.data;

  try {
    const post = id
      ? await prisma.blogPost.update({ where: { id }, data })
      : await prisma.blogPost.create({ data });
    return NextResponse.json({ ok: true, data: post });
  } catch {
    return NextResponse.json({ ok: false, error: "That slug is already taken." }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  await prisma.blogPost.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

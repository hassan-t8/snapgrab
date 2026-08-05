import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PostEditor from "@/components/admin/PostEditor";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: PageProps<"/admin/blogs/[id]">) {
  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id } }).catch(() => null);
  if (!post) notFound();

  return (
    <PostEditor
      initial={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        cover: post.cover ?? "",
        tags: post.tags,
        author: post.author,
        published: post.published,
      }}
    />
  );
}

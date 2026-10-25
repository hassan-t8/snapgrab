import { PrismaClient } from "../src/generated/prisma";
import { GUIDES } from "./guides";

/**
 * Adds any guide from prisma/guides.ts that is not in the database yet. Runs on every deploy;
 * never overwrites a post (so edits made in the admin panel are kept) and never touches admin users.
 */
const prisma = new PrismaClient();

async function main() {
  let added = 0;
  for (const g of GUIDES) {
    const exists = await prisma.blogPost.findUnique({ where: { slug: g.slug }, select: { id: true } });
    if (exists) continue;
    await prisma.blogPost.create({ data: g });
    added++;
  }
  console.log(`✔ guides: ${added} added, ${GUIDES.length - added} already there`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

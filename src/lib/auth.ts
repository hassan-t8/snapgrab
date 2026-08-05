import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "sg_admin";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export type AdminSession = { sub: string; email: string; name: string; role: string };

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return null;
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  return user;
}

export async function createSession(user: { id: string; email: string; name: string; role: string }) {
  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, secret(), {
    expiresIn: MAX_AGE,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return jwt.verify(token, secret()) as AdminSession;
  } catch {
    return null;
  }
}

/** Throws a 401-shaped error for API routes. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);

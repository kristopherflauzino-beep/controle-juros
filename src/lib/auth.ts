import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export type Session = { userId: string; role: "ADMIN" | "CLIENT"; name: string };
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "development-only-secret-change-me");

export async function createToken(session: Session) {
  return new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
}
export async function readToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload as unknown as Session; } catch { return null; }
}
export async function getSession() { return readToken((await cookies()).get("session")?.value); }
export async function getRequestSession(req: NextRequest) { return readToken(req.cookies.get("session")?.value); }

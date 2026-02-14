import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { hashPassword, verifyPassword } from "@/lib/auth";

export type BossSessionPayload = {
  bossId: string;
  sub: "boss";
};

const BOSS_SESSION_COOKIE_NAME = "kora_boss_session";

export function getBossSessionCookieName() {
  return BOSS_SESSION_COOKIE_NAME;
}

export { hashPassword, verifyPassword };

export async function signBossSessionToken(payload: BossSessionPayload) {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyBossSessionToken(token: string) {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  const p = payload as unknown as BossSessionPayload;
  if (p?.sub !== "boss" || !p?.bossId) return null;
  return p;
}

function getJwtSecret() {
  const value = process.env.JWT_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set");
  }
  const effectiveSecret = value ?? "kora-dev-only-jwt-secret-change-me";
  return new TextEncoder().encode(effectiveSecret);
}

export async function getBossSession(request: NextRequest) {
  const token = request.cookies.get(getBossSessionCookieName())?.value;
  if (!token) return null;
  return verifyBossSessionToken(token);
}

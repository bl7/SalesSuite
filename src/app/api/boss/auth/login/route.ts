import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  getBossSessionCookieName,
  hashPassword,
  signBossSessionToken,
  verifyPassword,
} from "@/lib/boss-auth";

const bodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

type Row = { id: string; email: string; password_hash: string; full_name: string };

export async function POST(request: NextRequest) {
  const parse = bodySchema.safeParse(await request.json());
  if (!parse.success) {
    return jsonError(400, parse.error.issues[0]?.message ?? "Invalid body");
  }

  const email = parse.data.email.toLowerCase().trim();
  const db = getDb();

  const result = await db.query<Row>(
    "SELECT id, email, password_hash, full_name FROM bosses WHERE email = $1 LIMIT 1",
    [email]
  );
  const row = result.rows[0];
  if (!row) {
    return jsonError(401, "Invalid email or password");
  }

  const valid = await verifyPassword(parse.data.password, row.password_hash);
  if (!valid) {
    return jsonError(401, "Invalid email or password");
  }

  const token = await signBossSessionToken({ bossId: row.id, sub: "boss" });
  const res = jsonOk({
    boss: { id: row.id, email: row.email, fullName: row.full_name || "" },
  });

  res.cookies.set({
    name: getBossSessionCookieName(),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { getBossSession, hashPassword } from "@/lib/boss-auth";

const createSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().max(255).optional(),
});

type BossRow = { id: string; email: string; full_name: string; created_at: string };

export async function GET(request: NextRequest) {
  const session = await getBossSession(request);
  if (!session) return jsonError(401, "Unauthorized");

  const db = getDb();
  const result = await db.query<BossRow>(
    "SELECT id, email, full_name, created_at::text FROM bosses ORDER BY created_at DESC"
  );

  return jsonOk({
    bosses: result.rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name || "",
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getBossSession(request);
  if (!session) return jsonError(401, "Unauthorized");

  const parse = createSchema.safeParse(await request.json());
  if (!parse.success) {
    return jsonError(400, parse.error.issues[0]?.message ?? "Invalid body");
  }

  const email = parse.data.email.toLowerCase().trim();
  const db = getDb();

  const existing = await db.query("SELECT id FROM bosses WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return jsonError(409, "A boss with this email already exists");
  }

  const passwordHash = await hashPassword(parse.data.password);
  const fullName = (parse.data.fullName ?? "").trim();

  await db.query(
    "INSERT INTO bosses (email, password_hash, full_name) VALUES ($1, $2, $3)",
    [email, passwordHash, fullName]
  );

  return jsonOk({ ok: true });
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { getBossSession, hashPassword } from "@/lib/boss-auth";

const updateSchema = z.object({
  email: z.string().email().max(255).optional(),
  fullName: z.string().max(255).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ bossId: string }> }
) {
  const session = await getBossSession(request);
  if (!session) return jsonError(401, "Unauthorized");

  const { bossId } = await context.params;
  const parse = updateSchema.safeParse(await request.json());
  if (!parse.success) {
    return jsonError(400, parse.error.issues[0]?.message ?? "Invalid body");
  }

  const isSelf = session.bossId === bossId;
  const { email, fullName, newPassword } = parse.data;

  if (newPassword !== undefined && !isSelf) {
    return jsonError(403, "You can only change your own password");
  }

  const db = getDb();

  const existing = await db.query<{ id: string }>("SELECT id FROM bosses WHERE id = $1", [bossId]);
  if (existing.rows.length === 0) return jsonError(404, "Boss not found");

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (email !== undefined) {
    const normalized = email.toLowerCase().trim();
    const conflict = await db.query("SELECT id FROM bosses WHERE email = $1 AND id != $2", [normalized, bossId]);
    if (conflict.rows.length > 0) return jsonError(409, "A boss with this email already exists");
    updates.push(`email = $${idx++}`);
    values.push(normalized);
  }
  if (fullName !== undefined) {
    updates.push(`full_name = $${idx++}`);
    values.push(fullName.trim());
  }
  if (newPassword !== undefined && isSelf) {
    const hash = await hashPassword(newPassword);
    updates.push(`password_hash = $${idx++}`);
    values.push(hash);
  }

  if (updates.length === 0) return jsonOk({ ok: true });

  values.push(bossId);
  await db.query(
    `UPDATE bosses SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
    values
  );

  return jsonOk({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ bossId: string }> }
) {
  const session = await getBossSession(request);
  if (!session) return jsonError(401, "Unauthorized");

  const { bossId } = await context.params;

  if (session.bossId === bossId) {
    return jsonError(400, "You cannot delete your own account");
  }

  const db = getDb();
  const result = await db.query("DELETE FROM bosses WHERE id = $1 RETURNING id", [bossId]);
  if (result.rowCount === 0) return jsonError(404, "Boss not found");

  return jsonOk({ ok: true });
}

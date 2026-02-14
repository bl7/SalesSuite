import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { getBossSessionCookieName, verifyBossSessionToken } from "@/lib/boss-auth";

type Row = { id: string; email: string; full_name: string };

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getBossSessionCookieName())?.value;
  if (!token) {
    return jsonError(401, "Not logged in");
  }

  const payload = await verifyBossSessionToken(token);
  if (!payload) {
    return jsonError(401, "Invalid session");
  }

  const db = getDb();
  const result = await db.query<Row>(
    "SELECT id, email, full_name FROM bosses WHERE id = $1 LIMIT 1",
    [payload.bossId]
  );
  const row = result.rows[0];
  if (!row) {
    return jsonError(401, "Boss not found");
  }

  return jsonOk({
    boss: {
      id: row.id,
      email: row.email,
      fullName: row.full_name || "",
    },
  });
}

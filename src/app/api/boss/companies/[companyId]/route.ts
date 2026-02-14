import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { getBossSession } from "@/lib/boss-auth";

const bodySchema = z.object({
  staffLimit: z.number().int().min(0).max(500),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const session = await getBossSession(request);
  if (!session) return jsonError(401, "Unauthorized");

  const { companyId } = await context.params;
  const parse = bodySchema.safeParse(await request.json());
  if (!parse.success) {
    return jsonError(400, parse.error.issues[0]?.message ?? "Invalid body");
  }

  const db = getDb();
  const result = await db.query(
    `UPDATE companies SET staff_limit = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [parse.data.staffLimit, companyId]
  );
  if (result.rowCount === 0) return jsonError(404, "Company not found");

  return jsonOk({ ok: true, staffLimit: parse.data.staffLimit });
}

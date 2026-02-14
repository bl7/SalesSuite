import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { getBossSession } from "@/lib/boss-auth";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_months"),
    months: z.number().int().min(1).max(120),
    note: z.string().max(1000).optional(),
    amountNotes: z.string().max(500).optional(),
    kind: z.enum(["payment", "complimentary"]).optional(),
  }),
  z.object({
    action: z.literal("add_days"),
    days: z.number().int().min(1).max(365),
    note: z.string().max(1000).optional(),
    kind: z.enum(["grace", "complimentary"]).optional(),
  }),
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("resume") }),
]);

export async function POST(
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

  if (parse.data.action === "add_months") {
    const { months, note, amountNotes, kind: paymentKind } = parse.data;
    const kind = paymentKind ?? "payment";
    const result = await db.query<{ subscription_ends_at: string | null }>(
      `SELECT subscription_ends_at FROM companies WHERE id = $1`,
      [companyId]
    );
    const row = result.rows[0];
    if (!row) return jsonError(404, "Company not found");

    const now = new Date();
    const currentEnd = row.subscription_ends_at ? new Date(row.subscription_ends_at) : null;
    const from = currentEnd && currentEnd > now ? currentEnd : now;
    const newEnd = new Date(from);
    newEnd.setMonth(newEnd.getMonth() + months);

    await db.query(
      `UPDATE companies SET subscription_ends_at = $1, subscription_suspended = false, updated_at = NOW() WHERE id = $2`,
      [newEnd.toISOString(), companyId]
    );

    await db.query(
      `INSERT INTO company_payments (company_id, months_added, days_added, kind, amount_notes, recorded_by_boss_id, notes)
       VALUES ($1, $2, NULL, $3, $4, $5, $6)`,
      [
        companyId,
        months,
        kind,
        amountNotes ?? null,
        session.bossId,
        note ?? null,
      ]
    );

    return jsonOk({
      ok: true,
      subscriptionEndsAt: newEnd.toISOString(),
    });
  }

  if (parse.data.action === "add_days") {
    const { days, note, kind: graceKind } = parse.data;
    const kind = graceKind ?? "grace";
    const result = await db.query<{ subscription_ends_at: string | null }>(
      `SELECT subscription_ends_at FROM companies WHERE id = $1`,
      [companyId]
    );
    const row = result.rows[0];
    if (!row) return jsonError(404, "Company not found");

    const now = new Date();
    const currentEnd = row.subscription_ends_at ? new Date(row.subscription_ends_at) : null;
    const from = currentEnd && currentEnd > now ? currentEnd : now;
    const newEnd = new Date(from);
    newEnd.setDate(newEnd.getDate() + days);

    await db.query(
      `UPDATE companies SET subscription_ends_at = $1, subscription_suspended = false, updated_at = NOW() WHERE id = $2`,
      [newEnd.toISOString(), companyId]
    );

    await db.query(
      `INSERT INTO company_payments (company_id, months_added, days_added, kind, amount_notes, recorded_by_boss_id, notes)
       VALUES ($1, 0, $2, $3, NULL, $4, $5)`,
      [companyId, days, kind, session.bossId, note ?? null]
    );

    return jsonOk({
      ok: true,
      subscriptionEndsAt: newEnd.toISOString(),
    });
  }

  if (parse.data.action === "suspend") {
    const result = await db.query(
      `UPDATE companies SET subscription_suspended = true, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [companyId]
    );
    if (result.rowCount === 0) return jsonError(404, "Company not found");
    return jsonOk({ ok: true });
  }

  if (parse.data.action === "resume") {
    const result = await db.query(
      `UPDATE companies SET subscription_suspended = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [companyId]
    );
    if (result.rowCount === 0) return jsonError(404, "Company not found");
    return jsonOk({ ok: true });
  }

  return jsonError(400, "Unknown action");
}

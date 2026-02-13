import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const allowCancelAfterShip = process.env.ALLOW_CANCEL_AFTER_SHIP === "true";

const cancelOrderSchema = z.object({
  cancel_reason: z.string().min(1, "Cancel reason is required").max(100),
  cancel_note: z.string().max(2000).optional(),
});

const CANCEL_REASONS = [
  "Customer requested",
  "Out of stock",
  "Duplicate order",
  "Wrong address",
  "Payment issue",
  "Other",
];

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const parseResult = cancelOrderSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const { cancel_reason, cancel_note } = parseResult.data;
  if (!CANCEL_REASONS.includes(cancel_reason)) {
    return jsonError(400, `cancel_reason must be one of: ${CANCEL_REASONS.join(", ")}`);
  }

  const { orderId } = await context.params;
  const companyId = authResult.session.companyId;
  const companyUserId = authResult.session.companyUserId;

  const current = await getDb().query<{ status: string }>(
    "SELECT status FROM orders WHERE id = $1 AND company_id = $2",
    [orderId, companyId]
  );
  if (!current.rowCount) return jsonError(404, "Order not found");

  const status = current.rows[0].status;
  const canCancelFromShipped = allowCancelAfterShip && status === "shipped";
  if (status !== "received" && status !== "processing" && !canCancelFromShipped) {
    return jsonError(400, `Order cannot be cancelled from status "${status}".`);
  }

  const result = await getDb().query(
    `
    UPDATE orders
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by_company_user_id = $1,
        cancel_reason = $2,
        cancel_note = $3
    WHERE id = $4 AND company_id = $5
    RETURNING *
    `,
    [companyUserId, cancel_reason, cancel_note ?? null, orderId, companyId]
  );

  if (!result.rowCount) return jsonError(404, "Order not found");
  return jsonOk({ order: result.rows[0] });
}

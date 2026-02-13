import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const ALLOWED_FORWARD: Record<string, string> = {
  received: "processing",
  processing: "shipped",
  shipped: "closed",
};

const updateOrderSchema = z.object({
  status: z.enum(["processing", "shipped", "closed"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function getOrderById(orderId: string, companyId: string, isRep: boolean, companyUserId?: string) {
  const conditions = ["o.id = $1", "o.company_id = $2"];
  const values: (string | number)[] = [orderId, companyId];
  if (isRep && companyUserId) {
    conditions.push("o.placed_by_company_user_id = $3");
    values.push(companyUserId);
  }
  const result = await getDb().query(
    `
    SELECT
      o.id, o.order_number, o.status, o.notes, o.total_amount, o.currency_code,
      o.placed_at, o.processed_at, o.shipped_at, o.closed_at,
      o.cancelled_at, o.cancelled_by_company_user_id, o.cancel_reason, o.cancel_note,
      o.created_at, o.updated_at,
      s.id AS shop_id, s.name AS shop_name, s.contact_name AS shop_contact_name,
      s.phone AS shop_phone, s.address AS shop_address,
      l.name AS lead_name,
      u.full_name AS placed_by_name,
      cu.id AS placed_by_company_user_id,
      cancelled_by_user.full_name AS cancelled_by_name,
      (
        SELECT json_agg(json_build_object(
          'id', oi.id, 'product_name', oi.product_name, 'product_sku', oi.product_sku,
          'quantity', oi.quantity, 'unit_price', oi.unit_price, 'line_total', oi.line_total, 'notes', oi.notes
        ) ORDER BY oi.created_at)
        FROM order_items oi
        WHERE oi.order_id = o.id AND oi.company_id = o.company_id
      ) AS items
    FROM orders o
    LEFT JOIN shops s ON s.id = o.shop_id AND s.company_id = o.company_id
    LEFT JOIN leads l ON l.id = o.lead_id
    LEFT JOIN company_users cu ON cu.id = o.placed_by_company_user_id AND cu.company_id = o.company_id
    LEFT JOIN users u ON u.id = cu.user_id
    LEFT JOIN company_users cb ON cb.id = o.cancelled_by_company_user_id AND cb.company_id = o.company_id
    LEFT JOIN users cancelled_by_user ON cancelled_by_user.id = cb.user_id
    WHERE ${conditions.join(" AND ")}
    `,
    values
  );
  return result.rows[0] ?? null;
}

/* ── GET — single order (drawer) ── */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "rep", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const { orderId } = await context.params;
  const isRep = authResult.session.role === "rep";
  const order = await getOrderById(
    orderId,
    authResult.session.companyId,
    isRep,
    authResult.session.companyUserId
  );
  if (!order) return jsonError(404, "Order not found");
  return jsonOk({ order });
}

/* ── PATCH — forward status only (no skip, no backwards); notes optional ── */

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const parseResult = updateOrderSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const input = parseResult.data;
  const { orderId } = await context.params;
  const companyId = authResult.session.companyId;

  const current = await getDb().query<{ status: string }>(
    "SELECT status FROM orders WHERE id = $1 AND company_id = $2",
    [orderId, companyId]
  );
  if (!current.rowCount) return jsonError(404, "Order not found");
  const currentStatus = current.rows[0].status;

  if (input.status !== undefined) {
    const allowedNext = ALLOWED_FORWARD[currentStatus];
    if (!allowedNext || allowedNext !== input.status) {
      return jsonError(400, `Invalid transition: ${currentStatus} → ${input.status}. Only forward steps allowed.`);
    }
  }

  const updates: string[] = [];
  const values: Array<string | null> = [];
  let pos = 1;

  if (input.status !== undefined) {
    updates.push(`status = $${pos}`);
    values.push(input.status);
    pos++;
    if (input.status === "processing") {
      updates.push("processed_at = COALESCE(processed_at, NOW())");
    } else if (input.status === "shipped") {
      updates.push("shipped_at = COALESCE(shipped_at, NOW())");
    } else if (input.status === "closed") {
      updates.push("closed_at = COALESCE(closed_at, NOW())");
    }
  }
  if (input.notes !== undefined) {
    updates.push(`notes = $${pos}`);
    values.push(input.notes);
    pos++;
  }

  if (!updates.length) return jsonError(400, "No fields provided to update");

  values.push(orderId, companyId);

  const result = await getDb().query(
    `UPDATE orders SET ${updates.join(", ")} WHERE id = $${pos++} AND company_id = $${pos} RETURNING *`,
    values
  );

  if (!result.rowCount) return jsonError(404, "Order not found");
  return jsonOk({ order: result.rows[0] });
}


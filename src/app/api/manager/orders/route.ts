import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const createOrderSchema = z.object({
  shopId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  currencyCode: z.string().length(3).default("NPR"),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        productName: z.string().min(1).max(200),
        productSku: z.string().max(80).optional(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1, "At least one item is required"),
});

/* ── GET — list orders ── */
// Query: status, q, date_from, date_to, rep (placed_by uuid), shop (shop_id uuid), sort=placed_at_asc|placed_at_desc

export async function GET(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "rep", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const dateFrom = searchParams.get("date_from")?.trim() ?? "";
  const dateTo = searchParams.get("date_to")?.trim() ?? "";
  const repId = searchParams.get("rep")?.trim() ?? "";
  const shopId = searchParams.get("shop")?.trim() ?? "";
  const sort = searchParams.get("sort")?.trim() ?? "placed_at_desc";
  const orderDir = sort === "placed_at_asc" ? "ASC" : "DESC";

  const isRep = authResult.session.role === "rep";
  const conditions: string[] = ["o.company_id = $1"];
  const values: (string | number)[] = [authResult.session.companyId];
  let pos = 2;

  if (isRep) {
    conditions.push(`o.placed_by_company_user_id = $${pos}`);
    values.push(authResult.session.companyUserId);
    pos++;
  }

  if (status) {
    conditions.push(`o.status = $${pos}`);
    values.push(status);
    pos++;
  }
  if (q) {
    conditions.push(`(o.order_number ILIKE $${pos} OR s.name ILIKE $${pos} OR u.full_name ILIKE $${pos})`);
    values.push(`%${q}%`);
    pos++;
  }
  if (dateFrom) {
    conditions.push(`o.placed_at >= $${pos}::timestamptz`);
    values.push(dateFrom);
    pos++;
  }
  if (dateTo) {
    conditions.push(`o.placed_at <= $${pos}::timestamptz`);
    values.push(dateTo);
    pos++;
  }
  if (repId) {
    conditions.push(`o.placed_by_company_user_id = $${pos}`);
    values.push(repId);
    pos++;
  }
  if (shopId) {
    conditions.push(`o.shop_id = $${pos}`);
    values.push(shopId);
    pos++;
  }

  const result = await getDb().query(
    `
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.notes,
      o.total_amount,
      o.currency_code,
      o.placed_at,
      o.processed_at,
      o.shipped_at,
      o.closed_at,
      o.cancelled_at,
      o.cancel_reason,
      o.created_at,
      o.updated_at,
      s.id AS shop_id,
      s.name AS shop_name,
      s.phone AS shop_phone,
      s.address AS shop_address,
      l.name AS lead_name,
      u.full_name AS placed_by_name,
      cu.id AS placed_by_company_user_id,
      (
        SELECT COALESCE(COUNT(*), 0)::int
        FROM order_items oi
        WHERE oi.order_id = o.id AND oi.company_id = o.company_id
      ) AS items_count,
      (
        SELECT json_agg(json_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'product_sku', oi.product_sku,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'line_total', oi.line_total,
          'notes', oi.notes
        ) ORDER BY oi.created_at)
        FROM order_items oi
        WHERE oi.order_id = o.id AND oi.company_id = o.company_id
      ) AS items
    FROM orders o
    LEFT JOIN shops s ON s.id = o.shop_id AND s.company_id = o.company_id
    LEFT JOIN leads l ON l.id = o.lead_id
    LEFT JOIN company_users cu ON cu.id = o.placed_by_company_user_id AND cu.company_id = o.company_id
    LEFT JOIN users u ON u.id = cu.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY o.placed_at ${orderDir}
    LIMIT 500
    `,
    values
  );

  return jsonOk({ orders: result.rows });
}

/* ── POST — create order ── */

export async function POST(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "rep"]);
  if (!authResult.ok) return authResult.response;

  const parseResult = createOrderSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const input = parseResult.data;
  const companyId = authResult.session.companyId;
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Generate order number: ORD-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const countResult = await client.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM orders WHERE company_id = $1 AND placed_at::date = CURRENT_DATE`,
      [companyId]
    );
    const seq = (parseInt(countResult.rows[0].cnt, 10) + 1).toString().padStart(4, "0");
    const orderNumber = `ORD-${dateStr}-${seq}`;

    // Calculate total
    const totalAmount = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Insert order
    const orderResult = await client.query<{ id: string }>(
      `
      INSERT INTO orders (company_id, order_number, shop_id, lead_id, placed_by_company_user_id, notes, total_amount, currency_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        companyId,
        orderNumber,
        input.shopId ?? null,
        input.leadId ?? null,
        authResult.session.companyUserId,
        input.notes ?? null,
        totalAmount,
        input.currencyCode,
      ]
    );

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of input.items) {
      await client.query(
        `
        INSERT INTO order_items (company_id, order_id, product_id, product_name, product_sku, quantity, unit_price, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          companyId,
          orderId,
          item.productId ?? null,
          item.productName,
          item.productSku ?? null,
          item.quantity,
          item.unitPrice,
          item.notes ?? null,
        ]
      );
    }

    // Auto-convert lead if lead_id provided
    if (input.leadId) {
      await client.query(
        `UPDATE leads SET status = 'converted', converted_at = NOW() WHERE id = $1 AND company_id = $2 AND status != 'converted'`,
        [input.leadId, companyId]
      );
    }

    await client.query("COMMIT");

    return jsonOk({ order: { id: orderId, orderNumber, totalAmount } }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    return jsonError(500, error instanceof Error ? error.message : "Could not create order");
  } finally {
    client.release();
  }
}


import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const updateProductSchema = z.object({
  sku: z.string().min(1).max(80).optional(),
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  unit: z.string().min(1).max(30).optional(),
  isActive: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

/* ── GET single product with price history ── */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "rep", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const { productId } = await context.params;

  const productResult = await getDb().query(
    `SELECT * FROM products WHERE id = $1 AND company_id = $2`,
    [productId, authResult.session.companyId]
  );

  if (!productResult.rowCount) return jsonError(404, "Product not found");

  const pricesResult = await getDb().query(
    `
    SELECT id, price, currency_code, starts_at, ends_at, created_at
    FROM product_prices
    WHERE product_id = $1 AND company_id = $2
    ORDER BY starts_at DESC
    `,
    [productId, authResult.session.companyId]
  );

  return jsonOk({ product: productResult.rows[0], prices: pricesResult.rows });
}

/* ── PATCH update product fields ── */

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const parseResult = updateProductSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const updates: string[] = [];
  const values: Array<string | number | boolean | null> = [];
  let pos = 1;
  const input = parseResult.data;

  if (input.sku !== undefined) { updates.push(`sku = $${pos}`); values.push(input.sku); pos++; }
  if (input.name !== undefined) { updates.push(`name = $${pos}`); values.push(input.name); pos++; }
  if (input.description !== undefined) { updates.push(`description = $${pos}`); values.push(input.description); pos++; }
  if (input.unit !== undefined) { updates.push(`unit = $${pos}`); values.push(input.unit); pos++; }
  const isActiveValue = input.isActive ?? (input.status === "inactive" ? false : input.status === "active" ? true : undefined);
  if (isActiveValue !== undefined) { updates.push(`is_active = $${pos}`); values.push(isActiveValue); pos++; }

  if (!updates.length) return jsonError(400, "No fields provided to update");

  const { productId } = await context.params;
  values.push(productId, authResult.session.companyId);

  try {
    const result = await getDb().query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = $${pos++} AND company_id = $${pos} RETURNING *`,
      values
    );

    if (!result.rowCount) return jsonError(404, "Product not found");
    return jsonOk({ product: result.rows[0] });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError(409, "A product with this SKU already exists");
    }
    return jsonError(500, error instanceof Error ? error.message : "Could not update product");
  }
}

/* ── DELETE product (only when order_count = 0) ── */

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const { productId } = await context.params;
  const db = getDb();

  const countResult = await db.query(
    `SELECT COUNT(DISTINCT order_id)::int AS cnt FROM order_items WHERE company_id = $1 AND product_id = $2`,
    [authResult.session.companyId, productId]
  );
  const orderCount = Number(countResult.rows[0]?.cnt ?? 0);
  if (orderCount > 0) {
    return jsonError(400, "Cannot delete products used in orders");
  }

  const result = await db.query(
    `DELETE FROM products WHERE id = $1 AND company_id = $2 RETURNING id`,
    [productId, authResult.session.companyId]
  );

  if (!result.rowCount) return jsonError(404, "Product not found");
  return jsonOk({ deleted: true });
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}


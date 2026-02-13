import { type NextRequest } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

const createProductSchema = z.object({
  sku: z.string().min(1).max(80),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  unit: z.string().min(1).max(30).default("unit"),
  price: z.number().nonnegative().optional(),
  currencyCode: z.string().length(3).default("NPR"),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "rep", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const statusParam = searchParams.get("status")?.toLowerCase();
  const statusFilter =
    statusParam === "inactive" ? false : statusParam === "active" ? true : null;

  const result = await getDb().query(
    `
    SELECT
      p.id,
      p.sku,
      p.name,
      p.description,
      p.unit,
      p.is_active,
      p.metadata,
      p.created_at,
      p.updated_at,
      (
        SELECT pp.price
        FROM product_prices pp
        WHERE pp.product_id = p.id
          AND pp.company_id = p.company_id
          AND pp.starts_at <= NOW()
          AND (pp.ends_at IS NULL OR pp.ends_at > NOW())
        ORDER BY pp.starts_at DESC
        LIMIT 1
      ) AS current_price,
      (
        SELECT pp.currency_code
        FROM product_prices pp
        WHERE pp.product_id = p.id
          AND pp.company_id = p.company_id
          AND pp.starts_at <= NOW()
          AND (pp.ends_at IS NULL OR pp.ends_at > NOW())
        ORDER BY pp.starts_at DESC
        LIMIT 1
      ) AS currency_code,
      (
        SELECT COUNT(DISTINCT oi.order_id)::int
        FROM order_items oi
        WHERE oi.company_id = p.company_id AND oi.product_id = p.id
      ) AS order_count
    FROM products p
    WHERE p.company_id = $1
      AND ($2::text = '' OR p.name ILIKE '%' || $2 || '%' OR p.sku ILIKE '%' || $2 || '%')
      AND ($3::boolean IS NULL OR p.is_active = $3)
    ORDER BY p.created_at DESC
    `,
    [authResult.session.companyId, q, statusFilter]
  );

  return jsonOk({ products: result.rows });
}

export async function POST(request: NextRequest) {
  const authResult = ensureRole(await getRequestSession(request), ["boss", "manager", "back_office"]);
  if (!authResult.ok) return authResult.response;

  const parseResult = createProductSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return jsonError(400, parseResult.error.issues[0]?.message ?? "Invalid body");
  }

  const input = parseResult.data;
  const db = getDb();

  try {
    // Insert product
    const isActive = input.status !== "inactive";
    const productResult = await db.query(
      `
      INSERT INTO products (company_id, sku, name, description, unit, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        authResult.session.companyId,
        input.sku,
        input.name,
        input.description ?? null,
        input.unit,
        isActive,
      ]
    );

    const product = productResult.rows[0];

    // If price provided, insert initial price
    if (input.price !== undefined) {
      await db.query(
        `
        INSERT INTO product_prices (company_id, product_id, price, currency_code)
        VALUES ($1, $2, $3, $4)
        `,
        [authResult.session.companyId, product.id, input.price, input.currencyCode]
      );
    }

    return jsonOk({ product }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError(409, "A product with this SKU already exists");
    }
    return jsonError(500, error instanceof Error ? error.message : "Could not create product");
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}


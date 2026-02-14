import { type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { ensureRole, getRequestSession, jsonError, jsonOk } from "@/lib/http";

/** Default placeholder coordinates (Kathmandu) until shop location is set. */
const DEFAULT_LAT = 27.7172;
const DEFAULT_LON = 85.324;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ leadId: string }> }
) {
  const authResult = ensureRole(await getRequestSession(request), [
    "boss",
    "manager",
    "rep",
  ]);
  if (!authResult.ok) return authResult.response;

  const { leadId } = await context.params;
  const companyId = authResult.session.companyId;
  const companyUserId = authResult.session.companyUserId;
  const role = authResult.session.role;
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const leadRow = await client.query<{
      id: string;
      name: string;
      contact_name: string | null;
      phone: string | null;
      address: string | null;
      status: string;
      shop_id: string | null;
      assigned_rep_company_user_id: string | null;
      created_by_company_user_id: string | null;
    }>(
      `SELECT id, name, contact_name, phone, address, status, shop_id,
              assigned_rep_company_user_id, created_by_company_user_id
       FROM leads WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [leadId, companyId]
    );

    if (!leadRow.rowCount) {
      await client.query("ROLLBACK");
      return jsonError(404, "Lead not found");
    }

    const lead = leadRow.rows[0]!;

    if (role === "rep") {
      const canConvert =
        lead.assigned_rep_company_user_id === companyUserId ||
        lead.created_by_company_user_id === companyUserId;
      if (!canConvert) {
        await client.query("ROLLBACK");
        return jsonError(
          403,
          "You can only convert leads that are assigned to you or that you added"
        );
      }
    }

    if (lead.status === "converted" && lead.shop_id) {
      await client.query("ROLLBACK");
      return jsonError(400, "Lead is already converted to a shop");
    }

    const shopResult = await client.query<{ id: string; name: string }>(
      `
      INSERT INTO shops (
        company_id,
        name,
        contact_name,
        phone,
        address,
        latitude,
        longitude,
        geofence_radius_m,
        location_source,
        location_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 60, 'manual_pin', false)
      RETURNING id, name
      `,
      [
        companyId,
        lead.name,
        lead.contact_name ?? null,
        lead.phone ?? null,
        lead.address ?? null,
        DEFAULT_LAT,
        DEFAULT_LON,
      ]
    );

    const shop = shopResult.rows[0]!;

    await client.query(
      `UPDATE leads
       SET status = 'converted', converted_at = COALESCE(converted_at, NOW()), shop_id = $1, updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [shop.id, leadId, companyId]
    );

    await client.query("COMMIT");

    return jsonOk({
      shop: { id: shop.id, name: shop.name },
      message: "Lead converted to shop. You can now place orders for this shop.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not convert lead to shop"
    );
  } finally {
    client.release();
  }
}

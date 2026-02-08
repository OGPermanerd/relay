import { NextRequest, NextResponse } from "next/server";
import { getTenantByVanityDomain } from "@everyskill/db/services/tenant";

/**
 * Caddy on-demand TLS validation endpoint.
 * Caddy calls GET /api/check-domain?domain=example.com before issuing a certificate.
 * Returns 200 if the domain belongs to an active tenant, 404 otherwise.
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "missing domain parameter" }, { status: 400 });
  }

  const tenant = await getTenantByVanityDomain(domain);
  if (!tenant) {
    return NextResponse.json({ error: "unknown domain" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, tenant: tenant.slug }, { status: 200 });
}

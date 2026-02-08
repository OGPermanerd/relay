import { headers } from "next/headers";
import { getTenantBySlug } from "@everyskill/db/services/tenant";
import { AnimatedLogo } from "@/components/animated-logo";

export async function TenantBranding() {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  // No subdomain = show default EverySkill logo
  if (!slug) {
    return <AnimatedLogo />;
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return <AnimatedLogo />;
  }

  // Paid tenant with logo: show tenant logo only
  if (tenant.plan === "paid" && tenant.logo) {
    return <img src={tenant.logo} alt={tenant.name} className="h-8 max-w-[140px] object-contain" />;
  }

  // Freemium: "TenantName x EverySkill"
  return (
    <div className="flex items-center gap-2">
      {tenant.logo && (
        <img src={tenant.logo} alt={tenant.name} className="h-6 w-6 rounded object-contain" />
      )}
      <span className="text-sm font-semibold text-gray-700">{tenant.name}</span>
      <span className="text-xs text-gray-400">x</span>
      <AnimatedLogo size="small" />
    </div>
  );
}

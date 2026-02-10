import { headers } from "next/headers";
import { getTenantBySlug } from "@everyskill/db/services/tenant";
import { AnimatedLogo } from "@/components/animated-logo";

interface TenantBrandingProps {
  theme?: "light" | "dark";
}

export async function TenantBranding({ theme = "light" }: TenantBrandingProps) {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  const logoVariant = theme === "dark" ? "dark" : "light";

  // No subdomain = show default EverySkill logo
  if (!slug) {
    return <AnimatedLogo variant={logoVariant} />;
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return <AnimatedLogo variant={logoVariant} />;
  }

  // Paid tenant with logo: show tenant logo only
  if (tenant.plan === "paid" && tenant.logo) {
    return <img src={tenant.logo} alt={tenant.name} className="h-8 max-w-[140px] object-contain" />;
  }

  // Freemium: "TenantName x EverySkill"
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-2">
      {tenant.logo && (
        <img src={tenant.logo} alt={tenant.name} className="h-6 w-6 rounded object-contain" />
      )}
      <span className={`text-sm font-semibold ${dark ? "text-[#dbe9f6]" : "text-gray-700"}`}>
        {tenant.name}
      </span>
      <span className={`text-xs ${dark ? "text-[#7a9ab4]" : "text-gray-400"}`}>x</span>
      <AnimatedLogo size="small" variant={logoVariant} />
    </div>
  );
}

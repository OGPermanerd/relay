const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export function isAdmin(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  return ADMIN_EMAILS.includes(userEmail);
}

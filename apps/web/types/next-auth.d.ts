import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      tenantId?: string;
      role?: "admin" | "member";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    role?: "admin" | "member";
  }
}

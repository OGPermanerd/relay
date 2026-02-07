import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      tenantId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
  }
}

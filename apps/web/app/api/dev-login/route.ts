/**
 * DEV ONLY: Bypass OAuth for local development
 *
 * Visit /api/dev-login to get authenticated as the test user.
 * This endpoint only works when NODE_ENV !== 'production'
 */
import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { db, users } from "@relay/db";

const TEST_USER = {
  id: "dev-test-user",
  email: "dev@company.com",
  name: "Dev User",
};

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "AUTH_SECRET not configured" }, { status: 500 });
  }

  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Ensure test user exists in database
    await db
      .insert(users)
      .values({
        id: TEST_USER.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: TEST_USER.email,
          name: TEST_USER.name,
          updatedAt: new Date(),
        },
      });

    // Create JWT token
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 24 * 60 * 60; // 24 hours

    const token = await encode({
      token: {
        id: TEST_USER.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
        sub: TEST_USER.id,
        iat: now,
        exp: expiresAt,
      },
      secret: authSecret,
      salt: "authjs.session-token",
    });

    // Create response with redirect to home
    const response = NextResponse.redirect(
      new URL("/skills", process.env.NEXTAUTH_URL || "http://localhost:2000")
    );

    // Set the session cookie
    response.cookies.set("authjs.session-token", token, {
      httpOnly: true,
      secure: false, // false for localhost
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("Dev login error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

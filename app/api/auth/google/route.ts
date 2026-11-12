import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, isAllowedEmail, googleConfig, saveGoogleAccount, sessionCookie } from "../../../lib/mail";

const stateCookie = "google-oauth-state";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  const redirectUri = `${origin}/api/auth/google`;
  const home = new URL("/", origin);
  let config;
  try {
    config = googleConfig();
    if (!process.env.SESSION_SECRET) throw new Error("Set SESSION_SECRET.");
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }

  const fail = (message: string) => {
    home.searchParams.set("login_error", message);
    return NextResponse.redirect(home);
  };
  if (url.searchParams.has("error")) return fail(`Google sign-in cancelled (${url.searchParams.get("error")}).`);
  const code = url.searchParams.get("code");
  if (!code) {
    const state = randomUUID();
    const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
      access_type: "offline",
      prompt: "consent",
      state,
    })}`);
    response.cookies.set(stateCookie, state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  }

  if (!url.searchParams.get("state") || url.searchParams.get("state") !== request.cookies.get(stateCookie)?.value) return fail("Login expired, sign in again.");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.refresh_token) {
    const hints: Record<string, string> = {
      redirect_uri_mismatch: `Google has not activated the redirect URI ${redirectUri} yet. Check it in Google Console and wait a few minutes.`,
      invalid_grant: "Google login code expired or was already used. Sign in again.",
      invalid_client: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is wrong in Vercel settings.",
    };
    return fail(`Gmail login failed (${tokens.error ?? "no refresh token"}): ${hints[tokens.error] ?? tokens.error_description ?? "try again."}`);
  }
  const profile = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();
  const email = String(profile.email ?? "").toLowerCase();
  if (!profile.email_verified || !isAllowedEmail(email)) return fail(`${email} is not allowed to use this app.`);
  await saveGoogleAccount({ email, name: profile.name ?? email, refreshToken: tokens.refresh_token });
  const response = NextResponse.redirect(home);
  const session = createSession(email);
  response.cookies.set(sessionCookie, session.value, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", maxAge: session.maxAge, path: "/" });
  response.cookies.delete(stateCookie);
  return response;
}

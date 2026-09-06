// zengtrade SaaS: authentication module.
// Auth is delegated to Supabase (never hand-rolled): password hashing, sessions, email
// verification, OAuth and magic links are all handled by a vetted provider. This file is only
// the thin glue + the route guard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON, AUTH_STORAGE_KEY, SITE } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    detectSessionInUrl: true,
    flowType: "pkce",
    persistSession: true,
    storageKey: AUTH_STORAGE_KEY,
  },
});

/* ---------------- OAuth / email-link callback ---------------- */

function authParamsInUrl() {
  const q = new URLSearchParams(location.search);
  const hash = location.hash || "";
  return {
    hasCode: q.has("code"),
    hasHash: /access_token=|refresh_token=|type=/.test(hash),
    hasError: q.has("error") || q.has("error_description"),
    error: q.get("error_description") || q.get("error"),
    code: q.get("code"),
  };
}

/** Finish an OAuth or email-link redirect (?code= or #access_token=). Cleans the URL. */
export async function completeAuthCallback() {
  const p = authParamsInUrl();
  if (p.hasError) {
    const clean = location.pathname;
    history.replaceState({}, "", clean);
    throw new Error(decodeURIComponent(String(p.error || "sign-in failed").replace(/\+/g, " ")));
  }
  if (!p.hasCode && !p.hasHash) return null;

  // BUG FIX (2026-09-06): this client is created with detectSessionInUrl:true, so it is
  // ALREADY exchanging this ?code=/#access_token= in the background the instant it's
  // constructed. This used to also call exchangeCodeForSession(p.code) itself for the
  // ?code= (PKCE) case: a second, redundant exchange of the same single-use code, racing
  // the SDK's own automatic one. Whichever call lost that race got an "already used" error
  // from Supabase, so a just-confirmed user landed back on an empty /login form as if
  // nothing happened; only a manual reload (which re-read the already-persisted session)
  // fixed it. getSession() awaits the SDK's own in-flight exchange internally, so, exactly
  // like the hash flow below already did, just wait on that instead of repeating it. The
  // short retry covers the real network round-trip that exchange takes on slower connections.
  for (let i = 0; i < 10; i++) {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    if (session) { history.replaceState({}, "", location.pathname); return session; }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

/** Await any in-flight OAuth callback, then return the active session (if any). */
export async function establishSession() {
  try {
    await completeAuthCallback();
  } catch (e) {
    // Surface to caller: login page shows the message.
    throw e;
  }
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

/* ---------------- sign up / in ---------------- */

export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: SITE.redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithMagicLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email, options: { emailRedirectTo: SITE.redirectTo },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: SITE.redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export async function resetPassword(email) {
  const redirectTo = (typeof location !== "undefined" ? location.origin : "https://zengtrade.in") + "/reset";
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function signOut() {
  await sb.auth.signOut();
  location.href = "/login";
}

/* ---------------- session ---------------- */

export async function currentUser() {
  await establishSession().catch(() => null);
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

/** Route guard: call at the top of any protected page. Redirects out if not signed in. */
export async function requireAuth() {
  try {
    await establishSession();
  } catch (e) {
    location.replace("/login?error=" + encodeURIComponent(niceError(e)));
    return null;
  }
  const { data } = await sb.auth.getUser();
  const user = data?.user || null;
  if (!user) { location.replace("/login"); return null; }
  await ensureProfile(user);
  return user;
}

/** First-run: make sure this user has a profile row. RLS means they can only ever write their own. */
async function ensureProfile(user) {
  const { data } = await sb.from("profile").select("id").eq("id", user.id).maybeSingle();
  if (!data) {
    await sb.from("profile").insert({
      id: user.id,
      display_name: (user.email || "").split("@")[0],
      risk_ack_at: new Date().toISOString(),
    });
  }
}

/** Friendly message for the auth errors users actually hit. */
export function niceError(e) {
  const m = (e && e.message ? e.message : String(e)).toLowerCase();
  if (m.includes("invalid login")) return "That email or password doesn't match.";
  if (m.includes("already registered")) return "That email already has an account. Try signing in.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("provider is not enabled")) return "Google sign-in isn't enabled yet. Use email and password, or contact support.";
  if (m.includes("redirect") && m.includes("url")) return "Google sign-in redirect isn't configured. Add " + SITE.redirectTo + " in Supabase → Auth → URL configuration.";
  if (m.includes("oauth") || m.includes("provider")) return e?.message || "Google sign-in failed. Try again or use email and password.";
  if (m.includes("password")) return "Password must be at least 8 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute.";
  return e?.message || "Something went wrong. Please try again.";
}

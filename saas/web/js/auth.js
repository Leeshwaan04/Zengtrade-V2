// zengtrade SaaS — authentication module.
// Auth is delegated to Supabase (never hand-rolled): password hashing, sessions, email
// verification, OAuth and magic links are all handled by a vetted provider. This file is only
// the thin glue + the route guard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON, SITE } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

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
    provider: "google", options: { redirectTo: SITE.redirectTo },
  });
  if (error) throw error;
}

export async function resetPassword(email) {
  // land on the dedicated set-new-password page (not the dashboard) so the user can actually
  // choose a new password from the recovery link.
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
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

/** Route guard: call at the top of any protected page. Redirects out if not signed in. */
export async function requireAuth() {
  const user = await currentUser();
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
  if (m.includes("provider") || m.includes("oauth")) return "Google sign-in isn't available yet. Please use email and password.";
  if (m.includes("password")) return "Password must be at least 8 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute.";
  return e?.message || "Something went wrong. Please try again.";
}

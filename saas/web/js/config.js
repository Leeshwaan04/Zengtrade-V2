// zengtrade SaaS: client config. PUBLIC-safe values only.
// The anon key is designed to be shipped to browsers; Row-Level Security protects the data.
// Payment secrets (NOWPayments API key + IPN secret) live ONLY in Supabase secrets, never here:
// the browser just calls the nowpayments-create-invoice Edge Function, which holds the key.
export const SUPABASE_URL  = window.__ZT_SUPABASE_URL  || "https://ponvarxeytfcntckczbn.supabase.co";
export const SUPABASE_ANON = window.__ZT_SUPABASE_ANON || "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1";

// Must match studio.js (deployed /dashboard) so OAuth sessions are visible to the terminal shim.
export const AUTH_STORAGE_KEY = "sb-ponvarxeytfcntckczbn-auth-token";

// GA4 property "zengtrade" (zengtrade.in), web stream 15728393601. A Measurement ID is meant to
// ship in page source, same trust model as the anon key above — the Measurement Protocol API
// secret used for SERVER-SIDE purchase events is a different, sensitive value and lives ONLY in
// Supabase secrets (GA_MEASUREMENT_PROTOCOL_SECRET), never here. See js/ga.js.
export const GA_MEASUREMENT_ID = "G-0YVJ0XVK7K";

const origin = typeof location !== "undefined" ? location.origin : "https://zengtrade.in";

export const SITE = {
  name: "zengtrade",
  // OAuth + email-confirm land on /login first so we can exchange ?code= before routing on.
  redirectTo: origin + "/login",
  // Post-auth product (Algo Studio customer edition on zengtrade.in).
  dashboard: origin + "/dashboard",
  // SaaS SPA: billing, evidence tabs, pricing hash route.
  app: origin + "/app",
};

// zengtrade SaaS — client config. PUBLIC-safe values only.
// The anon key is designed to be shipped to browsers; Row-Level Security protects the data.
// Payment secrets (NOWPayments API key + IPN secret) live ONLY in Supabase secrets, never here:
// the browser just calls the nowpayments-create-invoice Edge Function, which holds the key.
export const SUPABASE_URL  = window.__ZT_SUPABASE_URL  || "https://ponvarxeytfcntckczbn.supabase.co";
export const SUPABASE_ANON = window.__ZT_SUPABASE_ANON || "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1";

export const SITE = {
  name: "zengtrade",
  // where users land after completing OAuth / email confirmation
  redirectTo: (typeof location !== "undefined" ? location.origin : "") + "/dashboard",
};

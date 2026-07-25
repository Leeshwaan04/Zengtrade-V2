// zengtrade SaaS — client config.
// Fill these two values from your Supabase project (Settings → API). Both are PUBLIC-safe:
// the anon key is designed to be shipped to browsers; Row-Level Security is what protects data.
export const SUPABASE_URL  = window.__ZT_SUPABASE_URL  || "https://ponvarxeytfcntckczbn.supabase.co";
export const SUPABASE_ANON = window.__ZT_SUPABASE_ANON || "sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1";

export const SITE = {
  name: "zengtrade",
  // where users land after clicking a magic link / completing OAuth
  redirectTo: (typeof location !== "undefined" ? location.origin : "") + "/app.html",
};

// Polar checkout links (PUBLIC — these are just hosted checkout URLs; safe in the frontend).
// From Polar: Dashboard -> Products -> (each product) -> Checkout Link -> copy the URL.
// One per plan + cycle. Leave "" until you have them — the pricing page shows an honest
// "opening soon" state and openCheckout() no-ops gracefully until proMonth is a real URL.
export const POLAR = {
  proMonth:   window.__ZT_POLAR_PRO_M   || "",
  proYear:    window.__ZT_POLAR_PRO_Y   || "",
  eliteMonth: window.__ZT_POLAR_ELITE_M || "",
  eliteYear:  window.__ZT_POLAR_ELITE_Y || "",
};

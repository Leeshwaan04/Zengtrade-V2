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

// Lemon Squeezy checkout (PUBLIC — these appear in the buy link; safe in frontend).
// From LS: Store URL slug + the Pro product's Variant ID (Products -> variant -> Share/Buy link).
export const LEMONSQUEEZY = {
  storeSlug:          window.__ZT_LS_STORE      || "zengtrade",
  proVariantId:       window.__ZT_LS_PRO        || "YOUR_PRO_VARIANT_ID",
  proAnnualVariantId: window.__ZT_LS_PRO_YEAR   || "YOUR_PRO_ANNUAL_VARIANT_ID",
  eliteVariantId:     window.__ZT_LS_ELITE      || "YOUR_ELITE_VARIANT_ID",
  eliteAnnualVariantId: window.__ZT_LS_ELITE_YEAR || "YOUR_ELITE_ANNUAL_VARIANT_ID",
};

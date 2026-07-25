// zengtrade — billing (Polar). No secret here: checkout links are public; the server-side webhook
// (polar-webhook) grants Pro. Polar is a merchant-of-record, so it handles global tax. This module
// = the plan catalog + safe checkout (graceful until the Polar checkout links are set).
import { sb } from "./auth.js";
import { POLAR } from "./config.js";
import { toast } from "./ui.js";

export const FREE_DEPLOY_LIMIT = 1;

// the pricing model — mirrors the products you create in Polar
export const PLANS = [
  { id: "free", name: "Free", monthly: 0, annual: 0, tagline: "Learn & paper-trade — free forever",
    features: ["1 paper strategy", "Live crypto prices, 24/7", "Backtest + Forward Test", "Accuracy & Analytics", "Honest cost accounting"] },
  { id: "pro", name: "Pro", monthly: 29, annual: 290, featured: true, tagline: "For traders ready to go live",
    features: ["Everything in Free", "Unlimited paper strategies", "Live execution on your own exchange*", "Tick-level stops & kill-switch", "Email & push alerts"] },
  { id: "elite", name: "Elite", monthly: 79, annual: 790, tagline: "Maximum firepower",
    features: ["Everything in Pro", "Perps + options engines", "Multiple exchange accounts", "Custom risk parameters", "Priority support & early access"] },
];

// Polar Checkout Link URLs, one per plan+cycle (Polar Dashboard -> Products -> product -> Checkout Link).
const LINKS = {
  pro:   { month: POLAR.proMonth,   year: POLAR.proYear },
  elite: { month: POLAR.eliteMonth, year: POLAR.eliteYear },
};
const ready = (v) => !!v && /^https?:\/\//.test(v);
export const checkoutReady = () => ready(POLAR.proMonth);

export async function getTier(userId) {
  const { data } = await sb.from("profile").select("tier").eq("id", userId).maybeSingle();
  return data?.tier === "pro" ? "pro" : "free";
}
export const isPro = (t) => t === "pro";

export function openCheckout(user, plan = "pro", cycle = "month") {
  const base = LINKS[plan]?.[cycle] || LINKS[plan]?.month;
  if (!ready(base)) {
    toast("Checkout is being finalized — launching very soon.", "info"); return;
  }
  // Pass our Supabase user id so the webhook can map the subscription back to this account —
  // Polar carries customer_external_id + metadata through to every subscription event.
  const u = new URL(base);
  u.searchParams.set("customer_email", user.email || "");
  u.searchParams.set("customer_external_id", user.id);
  u.searchParams.set("metadata[user_id]", user.id);
  window.open(u.toString(), "_blank", "noopener");
}

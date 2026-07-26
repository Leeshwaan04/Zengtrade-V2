// zengtrade — billing (NOWPayments). NO secret in the browser: the client only asks a server-side
// Edge Function (nowpayments-create-invoice) to mint a hosted invoice, then redirects to it. The API
// key + IPN secret live ONLY in Supabase secrets; the IPN webhook (nowpayments-ipn) grants the tier.
import { sb } from "./auth.js";
import { SUPABASE_URL } from "./config.js";
import { toast } from "./ui.js";

export const FREE_DEPLOY_LIMIT = 1;

// the pricing model (mirrors PRICES in the create-invoice function; the function is authoritative).
export const PLANS = [
  { id: "free", name: "Free", monthly: 0, annual: 0, tagline: "Learn and paper-trade, free forever",
    features: ["1 paper strategy", "Live crypto prices, 24/7", "Backtest + Forward Test", "Accuracy & Analytics", "Honest cost accounting"] },
  { id: "pro", name: "Pro", monthly: 29, annual: 290, featured: true, tagline: "For traders ready to go live",
    features: ["Everything in Free", "Unlimited paper strategies", "Live execution on your own exchange*", "Tick-level stops & kill-switch", "Email & push alerts"] },
  { id: "elite", name: "Elite", monthly: 79, annual: 790, tagline: "Maximum firepower",
    features: ["Everything in Pro", "Perps + options engines", "Multiple exchange accounts", "Custom risk parameters", "Priority support & early access"] },
];

// invoices are created server-side on demand, so checkout is always available (no client link to set).
export const checkoutReady = () => true;

export async function getTier(userId) {
  const { data } = await sb.from("profile").select("tier").eq("id", userId).maybeSingle();
  const t = data?.tier;
  return t === "pro" || t === "elite" ? t : "free";
}
// "paid" gate: elite inherits everything Pro unlocks.
export const isPro = (t) => t === "pro" || t === "elite";

// Ask our Edge Function to mint a NOWPayments hosted invoice for this plan+cycle, then redirect to it.
export async function openCheckout(user, plan = "pro", cycle = "month") {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { toast("Please sign in first.", "info"); return; }
    toast("Starting secure checkout…", "info");
    const r = await fetch(`${SUPABASE_URL}/functions/v1/nowpayments-create-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan, cycle }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.invoice_url) { window.location.href = d.invoice_url; return; }
    toast(d.error || "Could not start checkout. Please try again.", "error");
  } catch {
    toast("Could not start checkout. Please try again.", "error");
  }
}

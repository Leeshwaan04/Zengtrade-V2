// Worker liveness: public heartbeat row (engine_state._worker_heartbeat).
import { sb } from "./auth.js";

const MAX_AGE_MS = 12 * 60 * 1000;
let bannerEl = null;

export async function isWorkerAlive() {
  try {
    const { data, error } = await sb.from("engine_state")
      .select("updated_at")
      .eq("key", "_worker_heartbeat")
      .maybeSingle();
    if (error || !data?.updated_at) return false;
    return Date.now() - new Date(data.updated_at).getTime() <= MAX_AGE_MS;
  } catch {
    return false;
  }
}

export async function maybeWorkerBanner() {
  const alive = await isWorkerAlive();
  if (alive) {
    bannerEl?.remove();
    bannerEl = null;
    return;
  }
  if (bannerEl || document.getElementById("ztWorkerDown")) return;
  bannerEl = document.createElement("div");
  bannerEl.id = "ztWorkerDown";
  bannerEl.setAttribute("role", "status");
  bannerEl.style.cssText =
    "position:sticky;top:0;z-index:80;padding:10px 16px;text-align:center;" +
    "font:600 13px/1.45 var(--sans,system-ui,sans-serif);" +
    "background:#fff8e6;color:#7a5a00;border-bottom:1px solid #f0d78a";
  bannerEl.innerHTML =
    'Paper worker is offline — deploys are saved but new trades won\u2019t run until the worker is back. ' +
    '<a href="/ops/worker" style="color:inherit;font-weight:700;margin-left:6px">Worker status</a> · ' +
    '<a href="/how-it-works/" style="color:inherit;font-weight:700">How paper trading works</a>';
  document.body.prepend(bannerEl);
}

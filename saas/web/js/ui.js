// zengtrade: UI toolkit. Zero dependencies, CSP-safe, theme-aware.
// Toasts (not alert), formatters, a hand-drawn equity curve, skeletons, safe HTML escaping.

// ---- safety: escape anything user-influenced before it touches innerHTML ----
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- formatters (global-friendly, tabular) ----
export const money = (n, dp = 0) => {
  const v = Number(n || 0), s = v < 0 ? "-" : "";
  return `${s}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
};
export const pct = (n, dp = 1) => `${Number(n || 0).toFixed(dp)}%`;
export const num = (n) => Number(n || 0).toLocaleString("en-US");
export function timeAgo(iso) {
  if (!iso) return "-";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const tone = (n) => Number(n) > 0 ? "pos" : Number(n) < 0 ? "neg" : "";

// ---- toasts ----
let toastHost;
export function toast(msg, type = "info", ms = 3800) {
  if (!toastHost) {
    toastHost = document.createElement("div"); toastHost.className = "toast-host"; document.body.appendChild(toastHost);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${esc(msg)}</span>`;
  toastHost.appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  const kill = () => { t.classList.remove("in"); setTimeout(() => t.remove(), 250); };
  t.addEventListener("click", kill);
  setTimeout(kill, ms);
}

// ---- loading skeleton ----
export const skeletonRows = (n = 3) =>
  Array.from({ length: n }, () => `<div class="skel-row"></div>`).join("");

// ---- equity curve on a <canvas> (retina-aware, theme-aware, no libs) ----
export function equityCurve(canvas, values) {
  if (!canvas) return;
  const css = getComputedStyle(document.documentElement);
  const green = css.getPropertyValue("--green").trim() || "#00ab4e";
  const red = css.getPropertyValue("--red").trim() || "#e5383b";
  const line = css.getPropertyValue("--line").trim() || "#e6eaf1";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  
  if (!values || values.length < 2) {
    ctx.fillStyle = css.getPropertyValue("--slate-2").trim() || "#94a3b8";
    ctx.font = "12px 'Roboto Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("No closed trades yet", W / 2, H / 2); return;
  }
  
  const pad = 12, min = Math.min(...values, 0), max = Math.max(...values, 0), rng = (max - min) || 1;
  const x = i => pad + (i / (values.length - 1)) * (W - 2 * pad);
  const y = v => H - pad - ((v - min) / rng) * (H - 2 * pad);
  const up = values[values.length - 1] >= 0;
  const col = up ? green : red;

  // zero baseline
  ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(pad, y(0)); ctx.lineTo(W - pad, y(0)); ctx.stroke(); ctx.setLineDash([]);

  // compute bezier control points
  const pts = values.map((v, i) => ({ x: x(i), y: y(v) }));
  
  // create path for area and line
  const drawSpline = (context) => {
    context.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[0];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  };

  // area fill with premium gradient
  const grad = ctx.createLinearGradient(0, pad, 0, H);
  grad.addColorStop(0, col + "55");
  grad.addColorStop(1, col + "00");
  ctx.beginPath();
  drawSpline(ctx);
  ctx.lineTo(pts[pts.length - 1].x, H);
  ctx.lineTo(pts[0].x, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // smooth glowing line
  ctx.beginPath();
  drawSpline(ctx);
  ctx.strokeStyle = col; 
  ctx.lineWidth = 2.5; 
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = col;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.stroke();
  
  // reset shadow for endpoint
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // glowing endpoint
  const lx = pts[pts.length - 1].x, ly = pts[pts.length - 1].y;
  ctx.beginPath(); 
  ctx.arc(lx, ly, 4, 0, Math.PI * 2); 
  ctx.fillStyle = css.getPropertyValue("--surface").trim() || "#fff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
}

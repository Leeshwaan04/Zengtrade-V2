// Shared admin gate for every /ops/* founder page. These pages used to have no auth at all -
// only a `noindex` meta tag, which stops search engines but not a direct URL hit from anyone
// (a crawler that ignores robots directives, a scanner, a shared link). Reuses the exact same
// requireAuth() + is_admin() RPC pattern /admin already gets right, so a non-admin session (or no
// session) is redirected to /login before this page's own script ever runs its founder-only probes.
import { requireAuth, sb, signOut } from "./auth.js";

export async function requireOpsAdmin() {
  const user = await requireAuth();               // redirects to /login if signed out
  if (!user) return false;
  const { data: ok } = await sb.rpc("is_admin");
  if (!ok) {
    await signOut();                               // signOut() itself redirects to /login
    return false;
  }
  return true;
}

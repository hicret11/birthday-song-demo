// Admin session cookie name. Kept in its own module (no node:crypto imports) so
// it can be imported by the edge-runtime `proxy.ts` AND by the Node-runtime
// `lib/admin-auth.ts` without pulling crypto into the edge bundle.
export const ADMIN_COOKIE = "smb_admin";

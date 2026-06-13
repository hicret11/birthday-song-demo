import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/admin-auth";
import { loginAction } from "../actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthed()) redirect("/admin/generations");
  const { error } = await searchParams;
  const message =
    error === "config"
      ? "Admin auth is not configured on the server (set ADMIN_PASSWORD and ADMIN_SESSION_SECRET)."
      : error === "ratelimit"
        ? "Too many attempts. Please wait and try again."
        : error === "invalid"
          ? "Invalid password."
          : null;

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-4 text-lg font-semibold">Sing My Birthday — Admin</h1>
      {message && (
        <p className="mb-3 rounded border border-red-800 bg-red-950 px-3 py-2 text-red-300">{message}</p>
      )}
      <form action={loginAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-neutral-400">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-fuchsia-600 px-3 py-2 font-semibold text-white hover:bg-fuchsia-500"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-xs text-neutral-500">Private. Authorized team members only.</p>
    </div>
  );
}

import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/user-session";

export const runtime = "nodejs";

async function signOut(request: Request): Promise<Response> {
  await clearUserSession();
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/`, 303);
}

export async function POST(request: Request): Promise<Response> {
  return signOut(request);
}
export async function GET(request: Request): Promise<Response> {
  return signOut(request);
}

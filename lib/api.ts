import "server-only";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";

export async function requireUser(): Promise<string | NextResponse> {
  const id = await currentUserId();
  return id ?? NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** フォーム送信なら画面へ戻し、fetch なら JSON を返す。 */
export function done(req: Request, redirectTo: string, json: unknown = { ok: true }) {
  const isForm = (req.headers.get("content-type") ?? "").includes("form");
  return isForm ? NextResponse.redirect(new URL(redirectTo, req.url), 303) : NextResponse.json(json);
}

export async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("json")) return (await req.json()) as Record<string, string>;
  return Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]));
}

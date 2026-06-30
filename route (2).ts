import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseBodyError(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) return error;
  return undefined;
}

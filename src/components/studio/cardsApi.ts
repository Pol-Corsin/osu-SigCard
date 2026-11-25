"use client";
/** Browser client for the published-cards API. The edit token travels only in the Authorization header. */
import type { OwnerCardResponse, PublishResponse } from "@/modules/cards/api-types";
import type { CardConfig } from "@/modules/cards/config";

export class CardApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new CardApiError("network", "You appear to be offline. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string; retryAfter?: number | null } } | null;
  if (!res.ok) {
    throw new CardApiError(body?.error?.code ?? "unknown", body?.error?.message ?? "Something went wrong. Try again.", body?.error?.retryAfter ?? null);
  }
  return body as T;
}

/** Random idempotency key for one publish attempt (reused on retry). */
export function newPublishKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const publishCard = (config: CardConfig, publishKey: string) =>
  call<PublishResponse>("/api/cards", { method: "POST", body: JSON.stringify({ config, publishKey }) });

export const loadCard = (id: string, token: string) => call<{ card: OwnerCardResponse }>(`/api/cards/${id}`, { token });

export const updateCard = (id: string, token: string, config: CardConfig, baseVersion: number) =>
  call<{ card: OwnerCardResponse }>(`/api/cards/${id}`, { method: "PATCH", token, body: JSON.stringify({ config, baseVersion }) });

export const refreshCard = (id: string, token: string) => call<{ card: OwnerCardResponse }>(`/api/cards/${id}/refresh`, { method: "POST", token, body: "{}" });

export const rotateEditLink = (id: string, token: string) =>
  call<{ editToken: string; editUrl: string }>(`/api/cards/${id}/token`, { method: "POST", token, body: "{}" });

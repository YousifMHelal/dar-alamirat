/**
 * Centralized fetch wrapper for all third-party integrations.
 *
 * Features:
 *  - Configurable timeout (default 10 s)
 *  - Automatic retry on transient failures (5xx, network errors) with
 *    exponential back-off (200 ms, 400 ms, 800 ms)
 *  - Typed response handling: callers supply a response type T and get a
 *    discriminated union back — never raw Response objects
 *  - Structured error surface: IntegrationError carries provider, status,
 *    and a parsed body so callers can surface specific messages
 */

export interface IntegrationError {
  provider: string;
  status: number | "network" | "timeout";
  message: string;
  /** Raw response body if the provider returned one. */
  body?: unknown;
}

export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IntegrationError };

interface FetchOptions {
  provider: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  /** Milliseconds before the request is aborted. Default: 10 000. */
  timeoutMs?: number;
  /** Max retry attempts on transient errors. Default: 2. */
  maxRetries?: number;
}

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function integrationFetch<T>(
  url: string,
  options: FetchOptions,
): Promise<IntegrationResult<T>> {
  const {
    provider,
    method = "GET",
    headers = {},
    body,
    timeoutMs = 10_000,
    maxRetries = 2,
  } = options;

  let attempt = 0;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Parse body — most APIs return JSON even on error.
      let parsed: unknown;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        try {
          parsed = await res.json();
        } catch {
          parsed = null;
        }
      } else {
        parsed = await res.text();
      }

      if (res.ok) {
        return { ok: true, data: parsed as T };
      }

      // Retry transient server errors.
      if (TRANSIENT_STATUSES.has(res.status) && attempt < maxRetries) {
        attempt++;
        await sleep(200 * Math.pow(2, attempt - 1));
        continue;
      }

      return {
        ok: false,
        error: {
          provider,
          status: res.status,
          message: extractMessage(parsed) ?? `HTTP ${res.status}`,
          body: parsed,
        },
      };
    } catch (err) {
      clearTimeout(timer);

      if ((err as Error).name === "AbortError") {
        return {
          ok: false,
          error: { provider, status: "timeout", message: "Request timed out" },
        };
      }

      if (attempt < maxRetries) {
        attempt++;
        await sleep(200 * Math.pow(2, attempt - 1));
        continue;
      }

      return {
        ok: false,
        error: {
          provider,
          status: "network",
          message: (err as Error).message ?? "Network error",
        },
      };
    }
  }

  // Should never reach here.
  return { ok: false, error: { provider, status: "network", message: "Exhausted retries" } };
}

function extractMessage(body: unknown): string | null {
  if (typeof body === "string") return body.slice(0, 200);
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const msg =
      b["message"] ?? b["error"] ?? b["error_description"] ?? b["detail"] ?? b["msg"];
    if (typeof msg === "string") return msg;
  }
  return null;
}

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Optional Upstash Redis — set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 * When unset, limits are skipped (dev / single-tenant). Production: enable to cap abuse.
 */

let redis: Redis | null = null;
try {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    redis = new Redis({ url, token });
  }
} catch {
  redis = null;
}

export const rateLimitRedisConfigured = redis !== null;

function makeLimiter(tokens: number, window: `${number} s`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: "stage",
  });
}

/** Heavy NDJSON discussion stream */
const discussLimiter = makeLimiter(12, "60 s");
/** Context graph infer/refine */
const contextLimiter = makeLimiter(30, "60 s");

export class RateLimitExceededError extends Error {
  constructor(message = "Too many requests") {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

export function getRateLimitKey(request: Request, userId: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return `u:${userId}:ip:${ip}`;
}

export async function enforceDiscussRateLimit(
  request: Request,
  userId: string,
): Promise<void> {
  if (!discussLimiter) return;
  const { success } = await discussLimiter.limit(getRateLimitKey(request, userId));
  if (!success) {
    throw new RateLimitExceededError(
      "Discussion rate limit — try again in a minute.",
    );
  }
}

export async function enforceContextRateLimit(
  request: Request,
  userId: string,
): Promise<void> {
  if (!contextLimiter) return;
  const { success } = await contextLimiter.limit(getRateLimitKey(request, userId));
  if (!success) {
    throw new RateLimitExceededError(
      "Context API rate limit — try again shortly.",
    );
  }
}

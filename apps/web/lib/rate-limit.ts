const rateLimitMaps = new Map<
  string,
  Map<string, { count: number; resetAt: number }>
>();

function getMap(
  namespace: string
): Map<string, { count: number; resetAt: number }> {
  const existing = rateLimitMaps.get(namespace);
  if (existing) {
    return existing;
  }
  const map = new Map<string, { count: number; resetAt: number }>();
  rateLimitMaps.set(namespace, map);
  return map;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function isRateLimited(
  ip: string,
  namespace: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const map = getMap(namespace);
  const now = Date.now();
  const entry = map.get(ip);

  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > maxRequests;
}

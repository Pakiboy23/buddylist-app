import { NextResponse } from 'next/server';

const DEFAULT_NATIVE_API_ORIGIN = 'https://hiitsme-app.vercel.app';
const CORS_ALLOWED_HEADERS = 'authorization, content-type';
const CORS_MAX_AGE_SECONDS = '86400';

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '');
}

function buildAllowedOrigins() {
  const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_API_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_NATIVE_API_ORIGIN,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeOrigin);

  return new Set([
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://127.0.0.1',
    'https://localhost',
    ...configuredOrigins,
  ]);
}

function resolveRequestOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return null;
  }

  const normalized = normalizeOrigin(origin);
  return buildAllowedOrigins().has(normalized) ? normalized : null;
}

function mergeHeaders(...headersList: Array<HeadersInit | undefined>) {
  const merged = new Headers();

  for (const headers of headersList) {
    if (!headers) {
      continue;
    }

    const current = new Headers(headers);
    current.forEach((value, key) => {
      if (key.toLowerCase() === 'vary' && merged.has(key)) {
        merged.set(key, `${merged.get(key)}, ${value}`);
        return;
      }

      merged.set(key, value);
    });
  }

  return merged;
}

function buildCorsHeaders(request: Request, methods: string[]) {
  const origin = resolveRequestOrigin(request);
  const headers = new Headers({
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': Array.from(new Set([...methods, 'OPTIONS'])).join(', '),
    'Access-Control-Max-Age': CORS_MAX_AGE_SECONDS,
    Vary: 'Origin',
  });

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

export function createCorsPreflightResponse(request: Request, methods: string[]) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request, methods),
  });
}

export function jsonWithCors<Data>(
  request: Request,
  data: Data,
  init: ResponseInit = {},
  methods: string[],
) {
  return NextResponse.json(data, {
    ...init,
    headers: mergeHeaders(buildCorsHeaders(request, methods), init.headers),
  });
}

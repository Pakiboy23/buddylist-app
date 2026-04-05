import { describe, expect, it } from 'vitest';
import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';

describe('apiCors', () => {
  it('echoes the native Capacitor origin on preflight responses', () => {
    const request = new Request('https://buddylist-app.vercel.app/api/push/dispatch', {
      method: 'OPTIONS',
      headers: {
        origin: 'capacitor://localhost',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });

    const response = createCorsPreflightResponse(request, ['POST']);

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('does not reflect unknown origins', () => {
    const request = new Request('https://buddylist-app.vercel.app/api/push/dispatch', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://malicious.example',
      },
    });

    const response = createCorsPreflightResponse(request, ['POST']);

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('adds CORS headers to JSON responses for native clients', async () => {
    const request = new Request('https://buddylist-app.vercel.app/api/auth/recovery/setup', {
      method: 'POST',
      headers: {
        origin: 'capacitor://localhost',
      },
    });

    const response = jsonWithCors(request, { ok: true }, { status: 201 }, ['POST']);

    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBe('capacitor://localhost');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  createMeshFiscalClient,
  idempotencyKey,
  iterateCursor,
  MeshFiscalRequestError,
  parseMeshFiscalError,
  waitForFiscalOperation,
} from '../src/index.js';

const baseUrl = 'https://api.example.test';
const key = `mfk_sb_lookupIdentifier_${'k'.repeat(43)}`;
const health = () => Response.json({ status: 'ok' });
const requestId = '0198c8bb-8e93-7a26-bd1e-31e65f4ad001';

describe('SDK transport resilience and credential boundaries', () => {
  it('retries only reads with the same request ID and credentials', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(health());
    const client = createMeshFiscalClient({
      baseUrl,
      authentication: { apiKey: key },
      fetchImplementation,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 10 },
    });
    await client.GET('/health/live');
    const requests = fetchImplementation.mock.calls.map(([request]) => request as Request);
    expect(requests).toHaveLength(2);
    expect(requests[0]!.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/);
    expect(requests[0]!.headers.get('X-Request-Id')).toBe(requests[1]!.headers.get('X-Request-Id'));
    for (const request of requests) {
      expect(request.headers.get('Authorization')).toBe(`Bearer ${key}`);
      expect(request.redirect).toBe('error');
    }
  });

  it('preserves caller correlation and retries transient read network failure', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('synthetic'))
      .mockResolvedValueOnce(health());
    const client = createMeshFiscalClient({
      baseUrl,
      fetchImplementation,
      retry: { maxAttempts: 2, initialDelayMs: 1 },
    });
    await client.GET('/health/live', { headers: { 'X-Request-Id': requestId } });
    expect((fetchImplementation.mock.calls[1]![0] as Request).headers.get('X-Request-Id')).toBe(
      requestId,
    );
    await expect(
      client.GET('/health/live', { headers: { 'X-Request-Id': 'invalid' } }),
    ).rejects.toThrow('UUIDv7');
  });

  it('does not repeat a mutating command, including one with an idempotency key', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const client = createMeshFiscalClient({
      baseUrl,
      fetchImplementation,
      retry: { maxAttempts: 4 },
    });
    await client.POST('/v1/organizations', {
      body: { name: 'Organização sintética' },
      params: { header: { 'Idempotency-Key': 'stable-command' } },
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it('does not shorten Retry-After or retry a permanent error', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '30' } }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    const client = createMeshFiscalClient({
      baseUrl,
      fetchImplementation,
      retry: { maxAttempts: 2 },
    });
    expect((await client.GET('/health/live')).response.status).toBe(429);
    expect((await client.GET('/health/live')).response.status).toBe(403);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it.each(['0', 'invalid', new Date(0).toUTCString()])(
    'handles bounded Retry-After %s',
    async (value) => {
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, { status: 502, headers: { 'Retry-After': value } }),
        )
        .mockResolvedValueOnce(health());
      const client = createMeshFiscalClient({
        baseUrl,
        fetchImplementation,
        retry: { maxAttempts: 2, initialDelayMs: 1 },
      });
      expect((await client.GET('/health/live')).response.status).toBe(200);
    },
  );

  it('stops a hung custom fetch within the total timeout and interrupts retry delays', async () => {
    const hung = createMeshFiscalClient({
      baseUrl,
      timeoutMs: 10,
      fetchImplementation: () => new Promise(() => {}),
    });
    await expect(hung.GET('/health/live')).rejects.toThrow();
    const controller = new AbortController();
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const client = createMeshFiscalClient({
      baseUrl,
      fetchImplementation,
      retry: { maxAttempts: 4 },
    });
    const pending = client.GET('/health/live', { signal: controller.signal });
    setTimeout(() => controller.abort(new Error('caller stopped')), 5);
    await expect(pending).rejects.toThrow('caller stopped');
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it('lets a concurrent OAuth waiter abort without cancelling the shared token request', async () => {
    let release: ((response: Response) => void) | undefined;
    const token = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchImplementation = vi.fn<typeof fetch>((input) =>
      new URL(input instanceof Request ? input.url : String(input)).pathname === '/oauth/token'
        ? token
        : Promise.resolve(health()),
    );
    const client = createMeshFiscalClient({
      baseUrl,
      fetchImplementation,
      authentication: {
        oauthClientCredentials: {
          clientId: 'mfc_sb_lookupIdentifier',
          clientSecret: `mfs_sb_${'x'.repeat(43)}`,
        },
      },
    });
    const controller = new AbortController();
    const aborted = client.GET('/health/live', { signal: controller.signal });
    const continued = client.GET('/health/live');
    controller.abort(new Error('cancelled waiter'));
    await expect(aborted).rejects.toThrow('cancelled waiter');
    release!(
      Response.json({ access_token: 'synthetic-access', expires_in: 300, token_type: 'Bearer' }),
    );
    expect((await continued).response.status).toBe(200);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it.each([
    'http://api.example.test',
    'https://api.example.test?token=no',
    'https://api.example.test#secret',
  ])('rejects unsafe base URL %s', (url) => {
    expect(() => createMeshFiscalClient({ baseUrl: url })).toThrow(TypeError);
  });

  it.each([
    { maxAttempts: 0 },
    { maxAttempts: 5 },
    { initialDelayMs: 0 },
    { maxDelayMs: 30_001 },
    { initialDelayMs: 500, maxDelayMs: 1 },
  ])('rejects invalid retry policy %j', (retry) => {
    expect(() => createMeshFiscalClient({ baseUrl, retry })).toThrow('retry requires');
  });

  it('rejects origin overrides before invoking fetch or attaching credentials', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const client = createMeshFiscalClient({
      baseUrl,
      authentication: { apiKey: key },
      fetchImplementation,
    });
    await expect(
      client.GET('/health/live', { baseUrl: 'https://attacker.example.test' }),
    ).rejects.toThrow('configured API origin');
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(createMeshFiscalClient({ baseUrl: 'http://127.0.0.1:3000' })).toBeDefined();
  });

  it.each(['window', 'document', 'navigator'])('rejects browser/mobile surface %s', (surface) => {
    vi.stubGlobal(surface, surface === 'navigator' ? { product: 'ReactNative' } : {});
    try {
      expect(() => createMeshFiscalClient({ baseUrl })).toThrow('server-side');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('SDK cursor, idempotency and error helpers', () => {
  it('iterates opaque cursor pages and supports an empty page', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], nextCursor: 'opaque' })
      .mockResolvedValueOnce({ data: [], nextCursor: 'final' })
      .mockResolvedValueOnce({ data: [3], nextCursor: null });
    const items = [];
    for await (const item of iterateCursor<number>(fetchPage)) items.push(item);
    expect(items).toEqual([1, 2, 3]);
    expect(fetchPage.mock.calls[1]).toEqual([{ cursor: 'opaque' }]);
  });

  it.each(['cycle', 'empty', 'limit', 'abort'])('fails bounded pagination: %s', async (kind) => {
    const controller = new AbortController();
    if (kind === 'abort') controller.abort(new Error('cursor stopped'));
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ data: [], nextCursor: kind === 'empty' ? '' : 'same' });
    const consume = async () => {
      for await (const item of iterateCursor<number>(fetchPage, {
        maximumPages: kind === 'limit' ? 1 : 5,
        signal: controller.signal,
      }))
        void item;
    };
    await expect(consume()).rejects.toThrow();
    if (kind === 'abort') expect(fetchPage).not.toHaveBeenCalled();
  });

  it('stops before yielding a response after cancellation', async () => {
    const controller = new AbortController();
    const consume = async () => {
      for await (const item of iterateCursor(
        () => {
          controller.abort(new Error('stopped after response'));
          return Promise.resolve({ data: [1], nextCursor: null });
        },
        { signal: controller.signal },
      ))
        void item;
    };
    await expect(consume()).rejects.toThrow('stopped after response');
  });

  it('builds stable namespaced keys and rejects invalid bounds', () => {
    const a = idempotencyKey('nfse', 'ERP pedido 100');
    expect(a).toBe(idempotencyKey('nfse', 'ERP pedido 100'));
    expect(a).not.toBe(idempotencyKey('nfse', 'ERP pedido 101'));
    expect(a.length).toBeLessThanOrEqual(128);
    for (const [namespace, reference] of [
      ['bad namespace', 'a'],
      ['nfe', ''],
      ['nfe', 'a'.repeat(4097)],
    ]) {
      expect(() => idempotencyKey(namespace!, reference!)).toThrow(TypeError);
    }
  });

  it('preserves typed Problem Details without exposing its detail as the error message', () => {
    const error = parseMeshFiscalError({
      type: 'https://api.meshfiscal.com/problems/invalid-payload',
      title: 'Inválido',
      status: 422,
      code: 'invalid_payload',
      detail: 'Dados fiscais informados inválidos.',
      requestId,
    });
    expect(error).toBeInstanceOf(MeshFiscalRequestError);
    expect(error).toMatchObject({ status: 422, code: 'invalid_payload', requestId });
    expect(error!.message).toBe('MeshFiscal request failed');
    expect(parseMeshFiscalError(null)).toBeNull();
  });

  it('validates polling backoff without invoking HTTP', async () => {
    const client = createMeshFiscalClient({ baseUrl });
    const locator = {
      projectId: requestId,
      operationId: requestId,
      environment: 'sandbox' as const,
    };
    for (const options of [
      { backoffFactor: 0 },
      { backoffFactor: 5 },
      { maximumPollIntervalMs: 1 },
      { maximumPollIntervalMs: 0 },
    ]) {
      await expect(waitForFiscalOperation(client, locator, options)).rejects.toThrow();
    }
  });
});

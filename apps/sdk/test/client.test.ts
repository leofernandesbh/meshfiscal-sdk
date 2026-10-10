import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  activateNfeContingency,
  confirmDistributionCursorRecoveryPlan,
  createDistributionCursorRecoveryPlan,
  createDistributionSubscription,
  createMeshFiscalClient,
  SDK_VERSION,
  createNfeBatchChunks,
  dfeIdempotencyKey,
  downloadArtifactContent,
  getUsageQuotaUnits,
  MeshFiscalEntitlementError,
  MeshFiscalArtifactIntegrityError,
  MeshFiscalOperationWaitTimeoutError,
  MeshFiscalQuotaError,
  nfeIdempotencyKey,
  parseCommercialAccessError,
  pollFiscalOperation,
  preferWait,
  submitNfe,
  submitNfeBatch,
  submitNfeCancellation,
  submitNfeContingencyReconciliation,
  submitNfeCorrectionLetter,
  submitNfeDanfe,
  submitNfeIssuerEvent,
  submitNfeNumberInvalidation,
  submitDistributionQuery,
  submitRecipientEvent,
  updateDistributionSubscription,
  verifyWebhookSignature,
  waitForFiscalOperation,
  type MeshFiscalClientOptions,
  type MeshFiscalClient,
  type MeshFiscalOperationRequestError,
  type MeshFiscalProblemDetails,
  type NfeBatch,
  type NfeCommand,
  type NfeDraftPayload,
  type DistributionQueryCommand,
  type DistributionSubscription,
  type RecipientEventCommand,
  type CursorRecoveryPlan,
  type UsageQuota,
} from '../src/index.js';
import signatureVectors from './fixtures/webhook-signature-vectors.json' with { type: 'json' };

const operation = {
  id: '019bf7db-4770-7538-b7e3-552f329fa3cf',
  type: 'sandbox_pipeline_probe',
  status: 'queued',
  targetRole: 'worker_general',
  targetType: 'sandbox_probe',
  targetId: '019bf7db-4770-7538-b7e3-552f329fa3d0',
  failureMode: 'none',
  attemptCount: 0,
  maxAttempts: 3,
  version: '1',
  createdAt: '2026-08-21T12:00:00.000Z',
  updatedAt: '2026-08-21T12:00:00.000Z',
  history: [],
  attempts: [],
} as const;
const organizationId = '019bf7db-4770-7538-b7e3-552f329fa3ce';
const projectId = '019bf7db-4770-7538-b7e3-552f329fa3cd';
const apiKey = `mfk_sb_lookupIdentifier_${'k'.repeat(43)}`;
const oauthClientId = 'mfc_sb_lookupIdentifier';
const oauthClientSecret = `mfs_sb_${'x'.repeat(43)}`;
const locator = {
  environment: 'sandbox',
  operationId: operation.id,
  organizationId,
  projectId,
} as const;
const artifactId = '019bf7db-4770-7538-b7e3-552f329fa3c1';
const artifactLocator = { artifactId, environment: 'sandbox', organizationId, projectId } as const;

const problem = (code: string): MeshFiscalProblemDetails => ({
  code,
  detail: 'A operação comercial foi recusada.',
  instance: '/v1/fiscal-documents',
  requestId: operation.id,
  status: 403,
  title: 'Operação não permitida',
  type: `https://api.meshfiscal.com/problems/${code}`,
});

const quota: UsageQuota = {
  alertsReached: [80, 100],
  compensatedUnits: '2',
  confirmedUnits: '6002',
  cycleId: operation.id,
  endsAt: '2026-09-01T03:00:00.000Z',
  includedUnits: '5000',
  netUnits: '6000',
  organizationId,
  overageUnits: '1000',
  planVersionId: operation.targetId,
  providerRatedUnits: '5750',
  reservedUnits: '3',
  startsAt: '2026-08-01T03:00:00.000Z',
  subscriptionId: projectId,
  unit: 'authorized_fiscal_document',
  usageOverageWaived: true,
  waivedUnits: '250',
};

describe('billing and usage helpers', () => {
  it('classifies only stable entitlement and quota Problem Details codes', () => {
    const entitlement = parseCommercialAccessError(problem('billing_entitlement_inactive'));
    const quotaError = parseCommercialAccessError(problem('usage_quota_exceeded'));

    expect(entitlement).toBeInstanceOf(MeshFiscalEntitlementError);
    expect(entitlement).toMatchObject({
      code: 'billing_entitlement_inactive',
      requestId: operation.id,
      status: 403,
    });
    expect(quotaError).toBeInstanceOf(MeshFiscalQuotaError);
    expect(quotaError).toMatchObject({ code: 'usage_quota_exceeded' });
    expect(parseCommercialAccessError(problem('route_not_found'))).toBeNull();
    expect(parseCommercialAccessError({ code: 'usage_quota_exceeded' })).toBeNull();
  });

  it('parses quota units exactly without IEEE-754 and computes the remaining allowance', () => {
    expect(getUsageQuotaUnits(quota)).toEqual({
      compensatedUnits: 2n,
      confirmedUnits: 6_002n,
      includedUnits: 5_000n,
      netUnits: 6_000n,
      overageUnits: 1_000n,
      providerRatedUnits: 5_750n,
      remainingIncludedUnits: 0n,
      reservedUnits: 3n,
      waivedUnits: 250n,
    });
    expect(
      getUsageQuotaUnits({ ...quota, includedUnits: null, netUnits: '9007199254740993' }),
    ).toMatchObject({ includedUnits: null, netUnits: 9_007_199_254_740_993n });
    expect(() => getUsageQuotaUnits({ ...quota, confirmedUnits: '1e3' })).toThrow(
      'confirmedUnits must be a canonical non-negative integer',
    );
  });
});

describe('NF-e helpers', () => {
  const nfePayload = {
    issuerId: '019bf7db-4770-7538-b7e3-552f329fa3c2',
    items: [
      {
        code: 'SKU-1',
        unitPrice: '9007199254740993.1234567890',
      },
    ],
  } as unknown as NfeDraftPayload;
  const nfeCommand = {
    document: { calculationSnapshot: { invoiceAmount: '9007199254740993.12' } },
    operation,
    reused: false,
    waitHit: true,
  } as unknown as NfeCommand;
  const nfeBatch = {
    completedItems: 0,
    failedItems: 0,
    id: operation.id,
    items: [],
    status: 'queued',
    totalItems: 1,
    version: '1',
  } as unknown as NfeBatch;
  const nfeLocator = { environment: 'sandbox', organizationId, projectId } as const;
  const nfeDocumentLocator = { ...nfeLocator, documentId: operation.targetId } as const;

  it('builds stable safe idempotency keys and bounded independent batch chunks', () => {
    expect(nfeIdempotencyKey('erp-order:2026-0001')).toBe('nfe:erp-order:2026-0001');
    expect(() => nfeIdempotencyKey('unsafe reference')).toThrow('safe ASCII');
    const chunks = createNfeBatchChunks(Array.from({ length: 51 }, () => nfePayload));
    expect(chunks.map((chunk) => chunk.length)).toEqual([50, 1]);
    expect(Object.isFrozen(chunks)).toBe(true);
    expect(Object.isFrozen(chunks[0])).toBe(true);
    expect(() => createNfeBatchChunks([])).toThrow('at least one');
  });

  it('submits one NF-e with idempotency and Prefer while preserving decimal strings', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ data: nfeCommand, response: new Response(null, { status: 202 }) });
    const client = { POST: post } as unknown as MeshFiscalClient;

    await expect(
      submitNfe(client, nfeLocator, nfePayload, {
        idempotencyKey: nfeIdempotencyKey('erp-order:2026-0001'),
        preferWaitSeconds: 5,
      }),
    ).resolves.toBe(nfeCommand);

    expect(post).toHaveBeenCalledWith(
      '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe',
      expect.objectContaining({
        body: nfePayload,
        params: {
          header: {
            'Idempotency-Key': 'nfe:erp-order:2026-0001',
            Prefer: 'wait=5',
          },
          path: nfeLocator,
        },
      }),
    );
    expect(nfePayload.items[0]?.unitPrice).toBe('9007199254740993.1234567890');
  });

  it('submits a bounded batch and refuses an implicit multi-request split', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ data: nfeBatch, response: new Response(null, { status: 202 }) });
    const client = { POST: post } as unknown as MeshFiscalClient;
    await expect(
      submitNfeBatch(client, nfeLocator, [nfePayload], {
        idempotencyKey: nfeIdempotencyKey('batch:2026-0001'),
      }),
    ).resolves.toBe(nfeBatch);
    expect(post.mock.calls[0]![1]).toMatchObject({
      body: { items: [nfePayload] },
      params: { header: { 'Idempotency-Key': 'nfe:batch:2026-0001' }, path: nfeLocator },
    });
    await expect(
      submitNfeBatch(
        client,
        nfeLocator,
        Array.from({ length: 51 }, () => nfePayload),
        {
          idempotencyKey: nfeIdempotencyKey('batch:too-large'),
        },
      ),
    ).rejects.toThrow('at most 50');
  });

  it('exposes F13 commands as explicit async resources without polling implicitly', async () => {
    const post = vi.fn((_path: string, _options: unknown) =>
      Promise.resolve({
        data: nfeCommand,
        response: new Response(null, { status: 202 }),
      }),
    );
    const client = { POST: post } as unknown as MeshFiscalClient;
    const options = {
      idempotencyKey: nfeIdempotencyKey('f13-command'),
      preferWaitSeconds: 4,
    } as const;

    await submitNfeCancellation(
      client,
      nfeDocumentLocator,
      {
        justification: 'Cancelamento solicitado antes da circulação',
        protocolNumber: '135260000000001',
      },
      options,
    );
    await submitNfeCorrectionLetter(
      client,
      nfeDocumentLocator,
      {
        acknowledgesLegalRestrictions: true,
        correction: 'Correção complementar sem alterar valores fiscais',
        sequence: 1,
      },
      options,
    );
    await submitNfeIssuerEvent(
      client,
      nfeDocumentLocator,
      {
        details: { effectivePaymentConfirmed: true },
        eventType: 'rtc_effective_payment',
        sequence: 1,
      },
      options,
    );
    await submitNfeNumberInvalidation(
      client,
      nfeLocator,
      {
        endNumber: 900_000_009,
        issuerId: nfePayload.issuerId,
        justification: 'Faixa não utilizada após falha operacional controlada',
        model: '55',
        series: 1,
        startNumber: 900_000_000,
        year: 26,
      },
      options,
    );
    await submitNfeDanfe(client, nfeDocumentLocator, { format: 'portrait' }, options);
    await activateNfeContingency(
      client,
      nfeDocumentLocator,
      {
        allowedModes: ['svc_an'],
        reason: 'Autorizador normal indisponível segundo sinais oficiais',
      },
      { idempotencyKey: options.idempotencyKey },
    );
    await submitNfeContingencyReconciliation(client, nfeDocumentLocator, options);

    const postPaths = (post.mock.calls as unknown[][]).map(([path]) => path);
    expect(postPaths).toEqual([
      expect.stringMatching(/\/cancellations$/),
      expect.stringMatching(/\/correction-letters$/),
      expect.stringMatching(/\/events$/),
      expect.stringMatching(/nfe-number-invalidations$/),
      expect.stringMatching(/\/danfe$/),
      expect.stringMatching(/\/contingency$/),
      expect.stringMatching(/\/contingency\/reconcile$/),
    ]);
    expect(post.mock.calls[0]![1]).toMatchObject({
      params: {
        header: { 'Idempotency-Key': 'nfe:f13-command', Prefer: 'wait=4' },
        path: nfeDocumentLocator,
      },
    });
  });

  it('propagates typed failures and forwards cancellation signals for every F13 command', async () => {
    const failure = problem('nfe_event_rejected');
    const post = vi.fn((_path: string, _options: unknown) =>
      Promise.resolve({
        error: failure,
        response: new Response(null, { status: 409 }),
      }),
    );
    const client = { POST: post } as unknown as MeshFiscalClient;
    const signal = new AbortController().signal;
    const options = {
      idempotencyKey: nfeIdempotencyKey('f13-failure'),
      signal,
    };
    const commands: readonly (() => Promise<unknown>)[] = [
      () =>
        submitNfeCancellation(
          client,
          nfeDocumentLocator,
          {
            justification: 'Cancelamento solicitado antes da circulação',
            protocolNumber: '135260000000001',
          },
          options,
        ),
      () =>
        submitNfeCorrectionLetter(
          client,
          nfeDocumentLocator,
          {
            acknowledgesLegalRestrictions: true,
            correction: 'Correção complementar sem alterar valores fiscais',
            sequence: 1,
          },
          options,
        ),
      () =>
        submitNfeIssuerEvent(
          client,
          nfeDocumentLocator,
          {
            details: { effectivePaymentConfirmed: true },
            eventType: 'rtc_effective_payment',
            sequence: 1,
          },
          options,
        ),
      () =>
        submitNfeNumberInvalidation(
          client,
          nfeLocator,
          {
            endNumber: 900_000_009,
            issuerId: nfePayload.issuerId,
            justification: 'Faixa não utilizada após falha operacional controlada',
            model: '55',
            series: 1,
            startNumber: 900_000_000,
            year: 26,
          },
          options,
        ),
      () => submitNfeDanfe(client, nfeDocumentLocator, { format: 'portrait' }, options),
      () =>
        activateNfeContingency(
          client,
          nfeDocumentLocator,
          {
            allowedModes: ['svc_an'],
            reason: 'Autorizador normal indisponível segundo sinais oficiais',
          },
          options,
        ),
      () => submitNfeContingencyReconciliation(client, nfeDocumentLocator, options),
    ];

    for (const command of commands) {
      await expect(command()).rejects.toMatchObject({
        code: 'nfe_request_failed',
        problem: failure,
        status: 409,
      });
    }
    expect(post).toHaveBeenCalledTimes(commands.length);
    for (const [, request] of post.mock.calls) {
      expect(request).toMatchObject({ signal });
      expect(request).not.toHaveProperty('params.header.Prefer');
    }
  });

  it('surfaces typed NF-e request failures for unit and batch commands', async () => {
    const failure = problem('nfe_validation_failed');
    const post = vi.fn().mockResolvedValue({
      error: failure,
      response: new Response(null, { status: 422 }),
    });
    const client = { POST: post } as unknown as MeshFiscalClient;

    await expect(
      submitNfe(client, nfeLocator, nfePayload, {
        idempotencyKey: nfeIdempotencyKey('invalid-unit'),
      }),
    ).rejects.toMatchObject({ code: 'nfe_request_failed', problem: failure, status: 422 });
    await expect(
      submitNfeBatch(client, nfeLocator, [nfePayload], {
        idempotencyKey: nfeIdempotencyKey('invalid-batch'),
      }),
    ).rejects.toMatchObject({ code: 'nfe_request_failed', problem: failure, status: 422 });
  });
});

describe('DF-e distribution helpers', () => {
  const locator = { environment: 'sandbox', organizationId, projectId } as const;
  const subscriptionId = '019bf7db-4770-7538-b7e3-552f329fa3b9';
  const planId = '019bf7db-4770-7538-b7e3-552f329fa3b8';
  const subscription = { id: subscriptionId, version: '1' } as unknown as DistributionSubscription;
  const queryCommand = {
    operation,
    query: { kind: 'latest_nsu' },
  } as unknown as DistributionQueryCommand;
  const eventCommand = {
    event: { automatic: false, type: 'operation_acknowledgement' },
    operation,
  } as unknown as RecipientEventCommand;
  const recoveryPlan = {
    dryRun: true,
    id: planId,
    status: 'pending_confirmation',
    version: '1',
  } as unknown as CursorRecoveryPlan;

  it('keeps subscription consent, manual queries, recipient intent and cursor confirmation explicit', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({ data: subscription, response: new Response(null, { status: 201 }) })
      .mockResolvedValueOnce({ data: queryCommand, response: new Response(null, { status: 202 }) })
      .mockResolvedValueOnce({ data: eventCommand, response: new Response(null, { status: 202 }) })
      .mockResolvedValueOnce({ data: recoveryPlan, response: new Response(null, { status: 201 }) })
      .mockResolvedValueOnce({ data: recoveryPlan, response: new Response(null, { status: 200 }) });
    const patch = vi
      .fn()
      .mockResolvedValue({ data: subscription, response: new Response(null, { status: 200 }) });
    const client = { PATCH: patch, POST: post } as unknown as MeshFiscalClient;
    const idempotencyKey = dfeIdempotencyKey('erp:received:1');

    await createDistributionSubscription(
      client,
      locator,
      {
        certificateId: artifactId,
        issuerId: operation.targetId,
        recipientTaxId: '11222333000181',
      },
      { idempotencyKey },
    );
    await updateDistributionSubscription(
      client,
      { ...locator, subscriptionId },
      {
        automationPolicy: 'acknowledge_operation',
        automationRiskAcknowledged: true,
        certificateId: artifactId,
        status: 'active',
      },
      { version: 1n },
    );
    await submitDistributionQuery(
      client,
      locator,
      {
        kind: 'latest_nsu',
        requestedNsu: '000000000000000',
        subscriptionId,
      },
      { idempotencyKey, preferWaitSeconds: 5 },
    );
    await submitRecipientEvent(
      client,
      locator,
      {
        details: {},
        receivedDfeId: operation.targetId,
        sequence: 1,
        type: 'operation_acknowledgement',
      },
      { idempotencyKey, preferWaitSeconds: 5 },
    );
    await createDistributionCursorRecoveryPlan(
      client,
      { ...locator, subscriptionId },
      {
        dryRun: true,
        proposedLastNsu: '000000000000010',
        reason: 'Recuperação revisada pelo responsável fiscal.',
      },
      { idempotencyKey },
    );
    await confirmDistributionCursorRecoveryPlan(
      client,
      { ...locator, planId, subscriptionId },
      { idempotencyKey, version: '1' },
    );

    const postPaths = (post.mock.calls as unknown[][]).map(([path]) => path);
    expect(postPaths).toEqual([
      expect.stringMatching(/distribution-subscriptions$/),
      expect.stringMatching(/distribution-queries$/),
      expect.stringMatching(/recipient-events$/),
      expect.stringMatching(/cursor-recovery-plans$/),
      expect.stringMatching(/cursor-recovery-plans\/\{planId\}\/confirm$/),
    ]);
    expect(patch.mock.calls[0]![1]).toMatchObject({
      body: {
        automationPolicy: 'acknowledge_operation',
        automationRiskAcknowledged: true,
      },
      params: { header: { 'If-Match': '"1"' } },
    });
    expect(post.mock.calls[1]![1]).toMatchObject({
      params: { header: { 'Idempotency-Key': idempotencyKey, Prefer: 'wait=5' } },
    });
    expect(post.mock.calls[2]![1]).toMatchObject({
      body: { type: 'operation_acknowledgement' },
    });
    expect(post.mock.calls[4]![1]).toMatchObject({
      params: { header: { 'Idempotency-Key': idempotencyKey, 'If-Match': '"1"' } },
    });
  });

  it('rejects unsafe keys or versions and surfaces Problem Details without hiding conflicts', async () => {
    expect(() => dfeIdempotencyKey('unsafe reference')).toThrow('safe ASCII');
    const patch = vi.fn();
    const client = {
      PATCH: patch,
      POST: vi.fn().mockResolvedValue({
        error: problem('dfe_recipient_event_conflict'),
        response: new Response(null, { status: 409 }),
      }),
    } as unknown as MeshFiscalClient;

    await expect(
      updateDistributionSubscription(
        client,
        { ...locator, subscriptionId },
        {
          automationPolicy: 'disabled',
          automationRiskAcknowledged: false,
          certificateId: artifactId,
          status: 'active',
        },
        { version: '0' },
      ),
    ).rejects.toThrow('canonical positive integer');
    expect(patch).not.toHaveBeenCalled();
    await expect(
      createDistributionSubscription(
        client,
        locator,
        {
          certificateId: artifactId,
          issuerId: operation.targetId,
          recipientTaxId: '11222333000181',
        },
        {
          idempotencyKey: dfeIdempotencyKey('subscription-conflict'),
          signal: new AbortController().signal,
        },
      ),
    ).rejects.toMatchObject({ code: 'dfe_request_failed', status: 409 });
    await expect(
      submitRecipientEvent(
        client,
        locator,
        {
          details: {},
          receivedDfeId: operation.targetId,
          sequence: 1,
          type: 'operation_confirmation',
        },
        { idempotencyKey: dfeIdempotencyKey('conflict') },
      ),
    ).rejects.toMatchObject({ code: 'dfe_request_failed', status: 409 });
  });
});

describe('verifyWebhookSignature', () => {
  it.each(signatureVectors.vectors)('verifies the shared $name golden vector', (vector) => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(vector.timestamp * 1_000);
    try {
      expect(
        verifyWebhookSignature(
          vector.rawBody,
          `t=${vector.timestamp},v1=${vector.signature}`,
          vector.secret,
          300,
        ),
      ).toBe(true);
    } finally {
      now.mockRestore();
    }
  });

  it('accepts rotating signatures and secrets while rejecting tampering and replay', () => {
    const vector = signatureVectors.vectors[0]!;
    const now = vi.spyOn(Date, 'now').mockReturnValue(vector.timestamp * 1_000);
    try {
      expect(
        verifyWebhookSignature(
          vector.rawBody,
          `t=${vector.timestamp},v1=${'0'.repeat(64)},v1=${vector.signature}`,
          ['mfwsec_an_old_secret_that_no_longer_matches', vector.secret],
          300,
        ),
      ).toBe(true);
      expect(
        verifyWebhookSignature(
          `${vector.rawBody} `,
          `t=${vector.timestamp},v1=${vector.signature}`,
          vector.secret,
          300,
        ),
      ).toBe(false);
      now.mockReturnValue((vector.timestamp + 301) * 1_000);
      expect(
        verifyWebhookSignature(
          vector.rawBody,
          `t=${vector.timestamp},v1=${vector.signature}`,
          vector.secret,
          300,
        ),
      ).toBe(false);
    } finally {
      now.mockRestore();
    }
  });

  it('fails closed for malformed headers and rejects unsafe caller configuration', () => {
    expect(verifyWebhookSignature('{}', 't=1,v1=invalid', 'mfwsec_a_safe_test_secret', 300)).toBe(
      false,
    );
    expect(() => verifyWebhookSignature('{}', 't=1,v1=invalid', 'short', 300)).toThrow(
      'Webhook secret is invalid',
    );
    expect(() =>
      verifyWebhookSignature('{}', 't=1,v1=invalid', 'mfwsec_a_safe_test_secret', 86_401),
    ).toThrow('tolerance');
  });
});

describe('createMeshFiscalClient', () => {
  it('calls a real generated system route with server-side identification and auth', async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test/',
      authentication: { apiKey },
      fetchImplementation,
    });

    const response = await client.GET('/health/live');

    expect(response.data).toEqual({ status: 'ok' });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [request] = fetchImplementation.mock.calls[0]!;
    expect(request).toBeInstanceOf(Request);
    const outgoingRequest = request as Request;
    expect(outgoingRequest.url).toBe('https://api.example.test/health/live');
    expect(outgoingRequest.headers.get('authorization')).toBe(`Bearer ${apiKey}`);
    expect(outgoingRequest.headers.get('user-agent')).toBe(`@meshfiscal/sdk/${SDK_VERSION}`);
  });

  it('rejects unsupported URL schemes', () => {
    expect(() => createMeshFiscalClient({ baseUrl: 'file:///tmp/meshfiscal' })).toThrow(
      'baseUrl must use http or https',
    );
    expect(() =>
      createMeshFiscalClient({ baseUrl: 'https://user:password@api.example.test' }),
    ).toThrow('baseUrl must not contain credentials');
  });

  it.each([0, -1, 1.5])('rejects invalid timeout %s', (timeoutMs) => {
    expect(() =>
      createMeshFiscalClient({ baseUrl: 'https://api.example.test', timeoutMs }),
    ).toThrow('timeoutMs must be a positive integer');
  });

  it('rejects ambiguous authentication at the runtime boundary', () => {
    const invalid = {
      baseUrl: 'https://api.example.test',
      authentication: { apiKey: 'one', accessToken: 'two' },
    } as unknown as MeshFiscalClientOptions;

    expect(() => createMeshFiscalClient(invalid)).toThrow(
      'apiKey, accessToken and oauthClientCredentials are mutually exclusive',
    );
  });

  it('rejects malformed or cross-environment developer credentials', () => {
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: { apiKey: 'synthetic-api-key' },
      }),
    ).toThrow('apiKey is invalid');
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: `mfs_pr_${'x'.repeat(43)}`,
          },
        },
      }),
    ).toThrow('OAuth client credentials are invalid');
  });

  it('supports access tokens, a custom timeout and an existing abort signal', async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const controller = new AbortController();
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      authentication: { accessToken: 'synthetic-access-token' },
      timeoutMs: 500,
      fetchImplementation,
    });

    await client.GET('/health/live', { signal: controller.signal });

    const [request] = fetchImplementation.mock.calls[0]!;
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new TypeError('Expected Request transport input');
    }
    expect(request.headers.get('authorization')).toBe('Bearer synthetic-access-token');
    expect(request.signal).not.toBe(controller.signal);
  });

  it('acquires one OAuth token for concurrent requests and reuses it before refresh', async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>((input, init) => {
      const request = new Request(input, init);
      if (request.url === 'https://api.example.test/oauth/token') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'short-lived-access-token',
              expires_in: 300,
              scope: 'operations:read',
              token_type: 'Bearer',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      authentication: {
        oauthClientCredentials: {
          clientId: oauthClientId,
          clientSecret: oauthClientSecret,
          scopes: ['operations:read'],
        },
      },
      fetchImplementation,
    });

    await Promise.all([client.GET('/health/live'), client.GET('/health/live')]);
    await client.GET('/health/live');

    const requests = fetchImplementation.mock.calls.map(
      ([input, init]) => new Request(input, init),
    );
    const tokenRequests = requests.filter(
      (request) => request.url === 'https://api.example.test/oauth/token',
    );
    expect(tokenRequests).toHaveLength(1);
    expect(tokenRequests[0]?.headers.get('authorization')).toBe(
      `Basic ${Buffer.from(`${oauthClientId}:${oauthClientSecret}`).toString('base64')}`,
    );
    expect(tokenRequests[0]?.redirect).toBe('error');
    expect(await tokenRequests[0]?.text()).toBe(
      'grant_type=client_credentials&scope=operations%3Aread',
    );
    for (const request of requests.filter((value) => value !== tokenRequests[0])) {
      expect(request.headers.get('authorization')).toBe('Bearer short-lived-access-token');
    }
  });

  it('refreshes OAuth once after the leeway boundary under concurrency', async () => {
    let now = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    let tokenNumber = 0;
    const fetchImplementation = vi.fn<typeof globalThis.fetch>((input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith('/oauth/token')) {
        tokenNumber += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: `access-token-${tokenNumber}`,
              expires_in: 60,
              token_type: 'Bearer',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
    });
    try {
      const client = createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: oauthClientSecret,
          },
        },
        fetchImplementation,
      });
      await client.GET('/health/live');
      now = 30_001;
      await Promise.all([client.GET('/health/live'), client.GET('/health/live')]);

      expect(tokenNumber).toBe(2);
      const apiRequests = fetchImplementation.mock.calls
        .map(([input, init]) => new Request(input, init))
        .filter((request) => !request.url.endsWith('/oauth/token'));
      expect(apiRequests.map((request) => request.headers.get('authorization'))).toEqual([
        'Bearer access-token-1',
        'Bearer access-token-2',
        'Bearer access-token-2',
      ]);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('fails closed on invalid OAuth responses without leaking secrets', async () => {
    const clientSecret = `mfs_sb_${'z'.repeat(43)}`;
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      authentication: {
        oauthClientCredentials: {
          clientId: oauthClientId,
          clientSecret,
        },
      },
      fetchImplementation: () =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: clientSecret }), {
            status: 401,
            headers: { 'content-type': 'application/problem+json' },
          }),
        ),
    });

    const request = client.GET('/health/live');
    await expect(request).rejects.toMatchObject({
      code: 'oauth_token_request_failed',
      status: 401,
    });
    await expect(request).rejects.not.toThrow(clientSecret);
  });

  it('rejects OAuth endpoints on another origin and duplicate scopes', () => {
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: oauthClientSecret,
            tokenEndpoint: 'https://attacker.example/oauth/token',
          },
        },
      }),
    ).toThrow('must use the MeshFiscal API origin');
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: oauthClientSecret,
            scopes: ['operations:read', 'operations:read'],
          },
        },
      }),
    ).toThrow('must not contain duplicates');
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: oauthClientSecret,
            tokenEndpoint: '/oauth/token?secret=forbidden',
          },
        },
      }),
    ).toThrow('must not contain credentials, query or fragment');
  });

  it('rejects invalid OAuth refresh, scope, endpoint protocol and empty access token', () => {
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: { accessToken: '' },
      }),
    ).toThrow('accessToken must not be empty');
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: oauthClientSecret,
            refreshLeewaySeconds: 301,
          },
        },
      }),
    ).toThrow('OAuth refresh leeway must be an integer from 0 to 300 seconds');
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: oauthClientSecret,
            scopes: ['scope with spaces'],
          },
        },
      }),
    ).toThrow('OAuth scopes are invalid');
    expect(() =>
      createMeshFiscalClient({
        baseUrl: 'https://api.example.test',
        authentication: {
          oauthClientCredentials: {
            clientId: oauthClientId,
            clientSecret: oauthClientSecret,
            tokenEndpoint: 'ftp://api.example.test/oauth/token',
          },
        },
      }),
    ).toThrow('OAuth token endpoint must use http or https');
  });

  it.each([
    {
      name: 'transport failure',
      fetchImplementation: () => Promise.reject(new Error('transport failed')),
      status: undefined,
    },
    {
      name: 'invalid JSON',
      fetchImplementation: () => Promise.resolve(new Response('{', { status: 200 })),
      status: 200,
    },
    {
      name: 'non-object token payload',
      fetchImplementation: () => Promise.resolve(Response.json(null, { status: 200 })),
      status: undefined,
    },
    {
      name: 'malformed token payload',
      fetchImplementation: () => Promise.resolve(Response.json({}, { status: 200 })),
      status: undefined,
    },
  ])('fails closed on OAuth $name', async ({ fetchImplementation, status }) => {
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      authentication: {
        oauthClientCredentials: {
          clientId: oauthClientId,
          clientSecret: oauthClientSecret,
        },
      },
      fetchImplementation,
    });

    await expect(client.GET('/health/live')).rejects.toMatchObject({
      code: 'oauth_token_request_failed',
      status,
    });
  });

  it('omits authorization without credentials and rejects browser-like runtimes', async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation,
    });
    await client.GET('/health/live');
    const [request] = fetchImplementation.mock.calls[0]!;
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new TypeError('Expected Request transport input');
    }
    expect(request.headers.has('authorization')).toBe(false);

    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    try {
      expect(() => createMeshFiscalClient({ baseUrl: 'https://api.example.test' })).toThrow(
        '@meshfiscal/sdk is intended for trusted server-side runtimes',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('downloadArtifactContent', () => {
  const bytes = Buffer.from('<?xml version="1.0"?><NFe><synthetic/></NFe>');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const digest = `sha-256=${Buffer.from(sha256, 'hex').toString('base64')}`;

  function response(body: Uint8Array, headers: Record<string, string> = {}) {
    return new Response(Uint8Array.from(body).buffer, {
      headers: {
        'cache-control': 'private, no-store',
        'content-disposition': 'attachment; filename="nfe_xml.xml"',
        'content-length': String(body.byteLength),
        'content-type': 'application/xml',
        digest,
        etag: `"${sha256}"`,
        ...headers,
      },
      status: 200,
    });
  }

  async function consume(body: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = body.getReader();
    const chunks: Buffer[] = [];
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return Buffer.concat(chunks);
      chunks.push(Buffer.from(chunk.value));
    }
  }

  it('streams authenticated bytes and verifies size, Digest, ETag, MIME and filename', async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(response(bytes)),
    );
    const client = createMeshFiscalClient({
      authentication: { apiKey },
      baseUrl: 'https://api.example.test',
      fetchImplementation,
    });
    const downloaded = await downloadArtifactContent(client, artifactLocator);

    expect(downloaded).toMatchObject({
      contentType: 'application/xml',
      fileName: 'nfe_xml.xml',
      sha256,
      sizeBytes: BigInt(bytes.byteLength),
    });
    await expect(consume(downloaded.body)).resolves.toEqual(bytes);
    const [request] = fetchImplementation.mock.calls[0]!;
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).headers.get('authorization')).toBe(`Bearer ${apiKey}`);
    expect((request as Request).url).toBe(
      `https://api.example.test/v1/organizations/${organizationId}/projects/${projectId}/environments/sandbox/artifacts/${artifactId}/content`,
    );
  });

  it('fails the stream when transported bytes do not match the authenticated digest', async () => {
    const corrupt = Buffer.from(bytes);
    corrupt[corrupt.byteLength - 1] = corrupt[corrupt.byteLength - 1]! ^ 1;
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation: () => Promise.resolve(response(corrupt)),
    });
    const downloaded = await downloadArtifactContent(client, artifactLocator);

    await expect(consume(downloaded.body)).rejects.toBeInstanceOf(MeshFiscalArtifactIntegrityError);
  });

  it('rejects unsafe metadata and surfaces only status for request errors', async () => {
    const unsafe = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation: () => Promise.resolve(response(bytes, { 'cache-control': 'public' })),
    });
    await expect(downloadArtifactContent(unsafe, artifactLocator)).rejects.toBeInstanceOf(
      MeshFiscalArtifactIntegrityError,
    );

    const denied = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation: () =>
        Promise.resolve(Response.json({ detail: 'diagnóstico não deve vazar' }, { status: 403 })),
    });
    await expect(downloadArtifactContent(denied, artifactLocator)).rejects.toMatchObject({
      code: 'artifact_download_request_failed',
      status: 403,
    });
  });
});

describe('fiscal operation helpers', () => {
  it('polls the generated detail route and waits through outcome_unknown', async () => {
    const fetchImplementation = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(operation), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...operation, status: 'outcome_unknown' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...operation, status: 'succeeded', version: '4' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation,
    });
    const polled: string[] = [];
    const result = await waitForFiscalOperation(client, locator, {
      timeoutMs: 100,
      pollIntervalMs: 1,
      onPoll: (value) => polled.push(value.status),
    });
    expect(result.status).toBe('succeeded');
    expect(polled).toEqual(['queued', 'outcome_unknown', 'succeeded']);
    const [firstRequest] = fetchImplementation.mock.calls[0]!;
    expect(firstRequest).toBeInstanceOf(Request);
    expect((firstRequest as Request).url).toBe(
      `https://api.example.test/v1/projects/${projectId}/environments/sandbox/fiscal-operations/${operation.id}`,
    );
    expect((firstRequest as Request).headers.get('x-organization-id')).toBe(organizationId);
  });

  it('surfaces request errors without leaking response bodies', async () => {
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation: () =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: 'internal diagnostic' }), {
            status: 503,
            headers: { 'content-type': 'application/problem+json' },
          }),
        ),
    });
    await expect(pollFiscalOperation(client, locator)).rejects.toMatchObject({
      code: 'fiscal_operation_request_failed',
      status: 503,
    } satisfies Partial<MeshFiscalOperationRequestError>);
  });

  it('times out, validates polling bounds and builds Prefer', async () => {
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation: () =>
        Promise.resolve(
          new Response(JSON.stringify(operation), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
    });
    await expect(
      waitForFiscalOperation(client, locator, {
        timeoutMs: 1,
        pollIntervalMs: 1,
      }),
    ).rejects.toBeInstanceOf(MeshFiscalOperationWaitTimeoutError);
    await expect(waitForFiscalOperation(client, locator, { timeoutMs: 0 })).rejects.toThrow(
      'timeoutMs must be a positive integer',
    );
    expect(preferWait(5)).toBe('wait=5');
    expect(() => preferWait(11)).toThrow('integer from 0 to 10');
  });

  it.each([
    { reason: new Error('synthetic abort'), expected: 'synthetic abort' },
    { reason: 'non-error abort', expected: 'Aborted' },
  ])('interrupts the polling delay for abort reason %#', async ({ reason, expected }) => {
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation: () =>
        Promise.resolve(
          new Response(JSON.stringify(operation), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
    });
    const controller = new AbortController();
    const waiting = waitForFiscalOperation(client, locator, {
      timeoutMs: 5_000,
      pollIntervalMs: 1_000,
      signal: controller.signal,
    });
    setImmediate(() => controller.abort(reason));

    await expect(waiting).rejects.toThrow(expected);
  });

  it('observes an abort that happens while a polling response is in flight', async () => {
    const controller = new AbortController();
    const client = createMeshFiscalClient({
      baseUrl: 'https://api.example.test',
      fetchImplementation: () => {
        controller.abort('aborted-during-response');
        return Promise.resolve(
          new Response(JSON.stringify(operation), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      },
    });

    await expect(
      waitForFiscalOperation(client, locator, {
        timeoutMs: 5_000,
        pollIntervalMs: 1_000,
        signal: controller.signal,
      }),
    ).rejects.toThrow('Aborted');
  });
});

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import createClient, { type Client } from 'openapi-fetch';

import type { components, operations, paths } from './generated/schema.js';

import { SDK_VERSION } from './generated/version.js';

export { SDK_VERSION } from './generated/version.js';
const DEFAULT_TIMEOUT_MS = 10_000;

export type MeshFiscalAuthentication =
  | {
      readonly apiKey: string;
      readonly accessToken?: never;
      readonly oauthClientCredentials?: never;
    }
  | {
      readonly apiKey?: never;
      readonly accessToken: string;
      readonly oauthClientCredentials?: never;
    }
  | {
      readonly apiKey?: never;
      readonly accessToken?: never;
      readonly oauthClientCredentials: OAuthClientCredentialsAuthentication;
    }
  | {
      readonly apiKey?: never;
      readonly accessToken?: never;
      readonly oauthClientCredentials?: never;
    };

export interface OAuthClientCredentialsAuthentication {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scopes?: readonly string[];
  readonly tokenEndpoint?: string;
  readonly refreshLeewaySeconds?: number;
}

export interface MeshFiscalClientOptions {
  readonly baseUrl: string;
  readonly authentication?: MeshFiscalAuthentication;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof globalThis.fetch;
  readonly retry?: {
    readonly maxAttempts?: number;
    readonly initialDelayMs?: number;
    readonly maxDelayMs?: number;
  };
}

export type MeshFiscalClient = Client<paths>;
export type { components, operations, paths } from './generated/schema.js';
export type AuditRecord = components['schemas']['AuditRecordResponse'];
export type ApiKey = components['schemas']['ApiKeyResponse'];
export type ApiKeyCreated = components['schemas']['ApiKeyCreatedResponse'];
export type Artifact = components['schemas']['ArtifactResponse'];
export type ArtifactEmailDelivery = components['schemas']['ArtifactEmailDeliveryResponse'];
export type ArtifactExport = components['schemas']['ArtifactExportResponse'];
export type ArtifactRetention = components['schemas']['ArtifactRetentionResponse'];
export type ArtifactStorageDestination = components['schemas']['StorageDestinationResponse'];
export type BillingPlan = components['schemas']['BillingPlanResponse'];
export type BillingPlanChangePreview = components['schemas']['BillingPlanChangePreviewResponse'];
export type BillingSession = components['schemas']['BillingSessionResponse'];
export type BillingSubscription = components['schemas']['BillingSubscriptionResponse'];
export type FiscalOperation = components['schemas']['FiscalOperationDetailsResponse'];
export type NfeArtifactLink = components['schemas']['NfeArtifactLinkResponse'];
export type NfeAuthorityQuery = components['schemas']['NfeAuthorityQueryResponse'];
export type NfeBatch = components['schemas']['NfeBatchResponse'];
export type NfeCommand = components['schemas']['NfeCommandResponse'];
export type NfeEventCommand = components['schemas']['NfeEventCommandResponse'];
export type NfeNumberInvalidationCommand =
  components['schemas']['NfeNumberInvalidationCommandResponse'];
export type NfeDanfeCommand = components['schemas']['NfeDanfeCommandResponse'];
export type NfeContingency = components['schemas']['NfeContingencyResponse'];
export type NfeContingencyCommand = components['schemas']['NfeContingencyCommandResponse'];
export type NfeDocument = components['schemas']['NfeDocumentResponse'];
export type NfeDocumentDetails = components['schemas']['NfeDocumentDetailsResponse'];
export type NfePreview = components['schemas']['NfePreviewResponse'];
export type NfeValidation = components['schemas']['NfeValidationResponse'];
export type NfeDraftPayload = operations['createNfe']['requestBody']['content']['application/json'];
export type NfeCancellationPayload =
  operations['cancelNfe']['requestBody']['content']['application/json'];
export type NfeCorrectionLetterPayload =
  operations['createNfeCorrectionLetter']['requestBody']['content']['application/json'];
export type NfeIssuerEventPayload =
  operations['createNfeIssuerEvent']['requestBody']['content']['application/json'];
export type NfeNumberInvalidationPayload =
  operations['createNfeNumberInvalidation']['requestBody']['content']['application/json'];
export type NfeDanfePayload =
  operations['requestNfeDanfe']['requestBody']['content']['application/json'];
export type NfeContingencyPayload =
  operations['activateNfeContingency']['requestBody']['content']['application/json'];
export type DistributionSubscription = components['schemas']['DistributionSubscriptionResponse'];
export type DistributionAutomationStatus =
  components['schemas']['DistributionAutomationStatusResponse'];
export type DistributionQuery = components['schemas']['DistributionQueryResponse'];
export type DistributionQueryCommand = components['schemas']['DistributionQueryCommandResponse'];
export type DistributionBatch = components['schemas']['DistributionBatchResponse'];
export type ReceivedDfe = components['schemas']['ReceivedDfeResponse'];
export type RecipientEvent = components['schemas']['RecipientEventResponse'];
export type RecipientEventCommand = components['schemas']['RecipientEventCommandResponse'];
export type CursorRecoveryPlan = components['schemas']['CursorRecoveryPlanResponse'];
export type CreateDistributionSubscriptionPayload =
  operations['createDistributionSubscription']['requestBody']['content']['application/json'];
export type UpdateDistributionSubscriptionPayload =
  operations['updateDistributionSubscription']['requestBody']['content']['application/json'];
export type DistributionQueryPayload =
  operations['createDistributionQuery']['requestBody']['content']['application/json'];
export type RecipientEventPayload =
  operations['createRecipientEvent']['requestBody']['content']['application/json'];
export type CursorRecoveryPlanPayload =
  operations['createDistributionCursorRecoveryPlan']['requestBody']['content']['application/json'];
export type HumanSecurityOverview = components['schemas']['HumanSecurityOverviewResponse'];
export type HumanSession = components['schemas']['HumanSessionResponse'];
export type Invitation = components['schemas']['InvitationResponse'];
export type Membership = components['schemas']['MembershipResponse'];
export type OAuthClient = components['schemas']['OAuthClientResponse'];
export type OAuthClientCreated = components['schemas']['OAuthClientCreatedResponse'];
export type Organization = components['schemas']['OrganizationResponse'];
export type Project = components['schemas']['ProjectResponse'];
export type ProjectEnvironment = components['schemas']['ProjectEnvironmentResponse'];
export type MeshFiscalProblemDetails = components['schemas']['ProblemDetailsResponse'];
export type SandboxSimulation = components['schemas']['SandboxSimulationResponse'];
export type UsageEffect = components['schemas']['UsageEffectResponse'];
export type UsageQuota = components['schemas']['UsageQuotaResponse'];
export type UserProfile = components['schemas']['UserProfileResponse'];
export type WebhookDelivery = components['schemas']['WebhookDeliveryResponse'];
export type WebhookEndpoint = components['schemas']['WebhookEndpointResponse'];
export type WebhookEndpointCreated = components['schemas']['WebhookEndpointCreatedResponse'];
export type WebhookEvent = components['schemas']['WebhookEventResponse'];
export type WebhookReplay = components['schemas']['WebhookReplayResponse'];

export class MeshFiscalOperationRequestError extends Error {
  public readonly code = 'fiscal_operation_request_failed';

  public constructor(public readonly status: number | undefined) {
    super('Fiscal operation request failed');
    this.name = 'MeshFiscalOperationRequestError';
  }
}

export class MeshFiscalOperationWaitTimeoutError extends Error {
  public readonly code = 'fiscal_operation_wait_timeout';

  public constructor(public readonly operationId: string) {
    super('Fiscal operation did not reach a terminal state before the wait timeout');
    this.name = 'MeshFiscalOperationWaitTimeoutError';
  }
}

export class MeshFiscalOAuthTokenRequestError extends Error {
  public readonly code = 'oauth_token_request_failed';

  public constructor(public readonly status: number | undefined) {
    super('OAuth Client Credentials token request failed');
    this.name = 'MeshFiscalOAuthTokenRequestError';
  }
}

export class MeshFiscalArtifactDownloadRequestError extends Error {
  public readonly code = 'artifact_download_request_failed';

  public constructor(public readonly status: number | undefined) {
    super('Artifact download request failed');
    this.name = 'MeshFiscalArtifactDownloadRequestError';
  }
}

export class MeshFiscalArtifactIntegrityError extends Error {
  public readonly code = 'artifact_download_integrity_failed';

  public constructor() {
    super('Artifact download failed integrity verification');
    this.name = 'MeshFiscalArtifactIntegrityError';
  }
}

export class MeshFiscalNfeRequestError extends Error {
  public readonly code = 'nfe_request_failed';

  public constructor(
    public readonly status: number | undefined,
    public readonly problem: MeshFiscalProblemDetails | null,
  ) {
    super('NF-e request failed');
    this.name = 'MeshFiscalNfeRequestError';
  }
}

export class MeshFiscalDfeRequestError extends Error {
  public readonly code = 'dfe_request_failed';

  public constructor(
    public readonly status: number | undefined,
    public readonly problem: MeshFiscalProblemDetails | null,
  ) {
    super('DF-e request failed');
    this.name = 'MeshFiscalDfeRequestError';
  }
}

export type MeshFiscalEntitlementErrorCode =
  | 'billing_entitlement_inactive'
  | 'billing_environment_not_entitled'
  | 'billing_local_waiver_inactive'
  | 'billing_subscription_not_found';

export type MeshFiscalQuotaErrorCode = 'usage_quota_exceeded';

export class MeshFiscalEntitlementError extends Error {
  public readonly code: MeshFiscalEntitlementErrorCode;
  public readonly status: number;
  public readonly requestId: string;

  public constructor(public readonly problem: MeshFiscalProblemDetails) {
    super('MeshFiscal entitlement denied');
    this.name = 'MeshFiscalEntitlementError';
    this.code = problem.code as MeshFiscalEntitlementErrorCode;
    this.status = problem.status;
    this.requestId = problem.requestId;
  }
}

export class MeshFiscalQuotaError extends Error {
  public readonly code: MeshFiscalQuotaErrorCode;
  public readonly status: number;
  public readonly requestId: string;

  public constructor(public readonly problem: MeshFiscalProblemDetails) {
    super('MeshFiscal usage quota denied');
    this.name = 'MeshFiscalQuotaError';
    this.code = problem.code as MeshFiscalQuotaErrorCode;
    this.status = problem.status;
    this.requestId = problem.requestId;
  }
}

const ENTITLEMENT_ERROR_CODES: ReadonlySet<string> = new Set<MeshFiscalEntitlementErrorCode>([
  'billing_entitlement_inactive',
  'billing_environment_not_entitled',
  'billing_local_waiver_inactive',
  'billing_subscription_not_found',
]);

function problemDetails(value: unknown): MeshFiscalProblemDetails | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MeshFiscalProblemDetails>;
  return typeof candidate.code === 'string' &&
    typeof candidate.detail === 'string' &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.status === 'number' &&
    Number.isSafeInteger(candidate.status)
    ? (candidate as MeshFiscalProblemDetails)
    : null;
}

export function parseCommercialAccessError(
  value: unknown,
): MeshFiscalEntitlementError | MeshFiscalQuotaError | null {
  const problem = problemDetails(value);
  if (!problem) return null;
  if (ENTITLEMENT_ERROR_CODES.has(problem.code)) {
    return new MeshFiscalEntitlementError(problem);
  }
  return problem.code === 'usage_quota_exceeded' ? new MeshFiscalQuotaError(problem) : null;
}

export interface UsageQuotaUnits {
  readonly compensatedUnits: bigint;
  readonly confirmedUnits: bigint;
  readonly includedUnits: bigint | null;
  readonly netUnits: bigint;
  readonly overageUnits: bigint;
  readonly providerRatedUnits: bigint;
  readonly remainingIncludedUnits: bigint | null;
  readonly reservedUnits: bigint;
  readonly waivedUnits: bigint;
}

function usageUnits(value: string, field: string): bigint {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new TypeError(`${field} must be a canonical non-negative integer`);
  }
  return BigInt(value);
}

export function getUsageQuotaUnits(quota: UsageQuota): UsageQuotaUnits {
  const includedUnits =
    quota.includedUnits === null ? null : usageUnits(quota.includedUnits, 'includedUnits');
  const netUnits = usageUnits(quota.netUnits, 'netUnits');
  return Object.freeze({
    compensatedUnits: usageUnits(quota.compensatedUnits, 'compensatedUnits'),
    confirmedUnits: usageUnits(quota.confirmedUnits, 'confirmedUnits'),
    includedUnits,
    netUnits,
    overageUnits: usageUnits(quota.overageUnits, 'overageUnits'),
    providerRatedUnits: usageUnits(quota.providerRatedUnits, 'providerRatedUnits'),
    remainingIncludedUnits:
      includedUnits === null ? null : includedUnits > netUnits ? includedUnits - netUnits : 0n,
    reservedUnits: usageUnits(quota.reservedUnits, 'reservedUnits'),
    waivedUnits: usageUnits(quota.waivedUnits, 'waivedUnits'),
  });
}

export type MeshFiscalEnvironment = 'sandbox' | 'homologation' | 'production';

export interface NfeTenantLocator {
  readonly organizationId: string;
  readonly projectId: string;
  readonly environment: MeshFiscalEnvironment;
}

export interface SubmitNfeOptions {
  readonly idempotencyKey: string;
  readonly preferWaitSeconds?: number;
  readonly signal?: AbortSignal;
}

export interface SubmitNfeBatchOptions {
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal;
}

export interface NfeDocumentLocator extends NfeTenantLocator {
  readonly documentId: string;
}

export interface SubmitNfeCommandOptions {
  readonly idempotencyKey: string;
  readonly preferWaitSeconds?: number;
  readonly signal?: AbortSignal;
}

export interface ActivateNfeContingencyOptions {
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal;
}

export interface DfeTenantLocator {
  readonly organizationId: string;
  readonly projectId: string;
  readonly environment: MeshFiscalEnvironment;
}

export interface DfeSubscriptionLocator extends DfeTenantLocator {
  readonly subscriptionId: string;
}

export interface DfeCursorRecoveryPlanLocator extends DfeSubscriptionLocator {
  readonly planId: string;
}

export interface SubmitDfeCommandOptions {
  readonly idempotencyKey: string;
  readonly preferWaitSeconds?: number;
  readonly signal?: AbortSignal;
}

export interface DfeIdempotentOptions {
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal;
}

export interface SubmitDfeVersionedCommandOptions {
  readonly idempotencyKey: string;
  readonly version: string | bigint;
  readonly signal?: AbortSignal;
}

export interface DfeVersionedOptions {
  readonly version: string | bigint;
  readonly signal?: AbortSignal;
}

export interface FiscalOperationLocator {
  readonly projectId: string;
  readonly environment: MeshFiscalEnvironment;
  readonly operationId: string;
  readonly organizationId?: string;
}

export interface WaitForFiscalOperationOptions {
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly maximumPollIntervalMs?: number;
  readonly backoffFactor?: number;
  readonly signal?: AbortSignal;
  readonly onPoll?: (operation: FiscalOperation) => void;
}

export interface ArtifactLocator {
  readonly artifactId: string;
  readonly environment: MeshFiscalEnvironment;
  readonly organizationId: string;
  readonly projectId: string;
}

export interface DownloadArtifactOptions {
  readonly signal?: AbortSignal;
}

export interface ArtifactDownload {
  readonly body: ReadableStream<Uint8Array>;
  readonly contentType: 'application/json' | 'application/pdf' | 'application/xml' | 'text/xml';
  readonly fileName: string;
  readonly sha256: string;
  readonly sizeBytes: bigint;
}

function assertServerRuntime(): void {
  const runtime = globalThis as typeof globalThis & {
    readonly document?: unknown;
    readonly window?: unknown;
    readonly navigator?: { readonly product?: string };
  };
  if (
    typeof process === 'undefined' ||
    !process.versions?.node ||
    (process as NodeJS.Process & { readonly type?: string }).type === 'renderer' ||
    runtime.window !== undefined ||
    runtime.document !== undefined ||
    runtime.navigator?.product === 'ReactNative'
  ) {
    throw new Error('@meshfiscal/sdk is intended for trusted server-side runtimes');
  }
}

function validateOptions(options: MeshFiscalClientOptions): void {
  const parsedBaseUrl = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) {
    throw new TypeError('baseUrl must use http or https');
  }
  if (parsedBaseUrl.username || parsedBaseUrl.password) {
    throw new TypeError('baseUrl must not contain credentials');
  }

  if (
    options.timeoutMs !== undefined &&
    (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1)
  ) {
    throw new TypeError('timeoutMs must be a positive integer');
  }

  if (parsedBaseUrl.search || parsedBaseUrl.hash) {
    throw new TypeError('baseUrl must not contain query or fragment');
  }
  if (
    parsedBaseUrl.protocol === 'http:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(parsedBaseUrl.hostname)
  ) {
    throw new TypeError('baseUrl requires TLS outside loopback');
  }
  if (options.retry) {
    const { maxAttempts = 1, initialDelayMs = 250, maxDelayMs = 5_000 } = options.retry;
    if (
      !Number.isSafeInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > 4 ||
      !Number.isSafeInteger(initialDelayMs) ||
      initialDelayMs < 1 ||
      !Number.isSafeInteger(maxDelayMs) ||
      maxDelayMs < initialDelayMs ||
      maxDelayMs > 30_000
    ) {
      throw new TypeError('retry requires 1 to 4 attempts and delays from 1 to 30000 milliseconds');
    }
  }

  const authentication = options.authentication;
  if (!authentication) {
    return;
  }

  const methods = [
    authentication.apiKey,
    authentication.accessToken,
    authentication.oauthClientCredentials,
  ].filter((value) => value !== undefined);
  if (methods.length > 1) {
    throw new TypeError('apiKey, accessToken and oauthClientCredentials are mutually exclusive');
  }

  if (
    authentication.apiKey !== undefined &&
    !/^mfk_(sb|hm|pr)_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/.test(authentication.apiKey)
  ) {
    throw new TypeError('apiKey is invalid');
  }
  if (authentication.accessToken !== undefined && authentication.accessToken.length === 0) {
    throw new TypeError('accessToken must not be empty');
  }

  const oauth = authentication.oauthClientCredentials;
  if (!oauth) {
    return;
  }
  if (
    !/^mfc_(sb|hm|pr)_[A-Za-z0-9_-]{16}$/.test(oauth.clientId) ||
    !/^mfs_(sb|hm|pr)_[A-Za-z0-9_-]{43}$/.test(oauth.clientSecret) ||
    oauth.clientId.slice(4, 6) !== oauth.clientSecret.slice(4, 6)
  ) {
    throw new TypeError('OAuth client credentials are invalid');
  }
  if (
    oauth.refreshLeewaySeconds !== undefined &&
    (!Number.isInteger(oauth.refreshLeewaySeconds) ||
      oauth.refreshLeewaySeconds < 0 ||
      oauth.refreshLeewaySeconds > 300)
  ) {
    throw new TypeError('OAuth refresh leeway must be an integer from 0 to 300 seconds');
  }
  if (
    oauth.scopes?.some(
      (scope) => typeof scope !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(scope),
    )
  ) {
    throw new TypeError('OAuth scopes are invalid');
  }
  if (oauth.scopes && new Set(oauth.scopes).size !== oauth.scopes.length) {
    throw new TypeError('OAuth scopes must not contain duplicates');
  }

  const tokenEndpoint = new URL(oauth.tokenEndpoint ?? '/oauth/token', parsedBaseUrl);
  if (!['http:', 'https:'].includes(tokenEndpoint.protocol)) {
    throw new TypeError('OAuth token endpoint must use http or https');
  }
  if (tokenEndpoint.origin !== parsedBaseUrl.origin) {
    throw new TypeError('OAuth token endpoint must use the MeshFiscal API origin');
  }
  if (
    tokenEndpoint.username ||
    tokenEndpoint.password ||
    tokenEndpoint.search ||
    tokenEndpoint.hash
  ) {
    throw new TypeError('OAuth token endpoint must not contain credentials, query or fragment');
  }
}

interface CachedOAuthAccessToken {
  readonly accessToken: string;
  readonly refreshAt: number;
}

function parseOAuthTokenResponse(value: unknown): {
  readonly accessToken: string;
  readonly expiresIn: number;
} {
  if (!value || typeof value !== 'object') {
    throw new MeshFiscalOAuthTokenRequestError(undefined);
  }
  const response = value as Record<string, unknown>;
  if (
    typeof response.access_token !== 'string' ||
    response.access_token.length === 0 ||
    typeof response.expires_in !== 'number' ||
    !Number.isSafeInteger(response.expires_in) ||
    response.expires_in < 1 ||
    typeof response.token_type !== 'string' ||
    response.token_type.toLowerCase() !== 'bearer' ||
    'refresh_token' in response
  ) {
    throw new MeshFiscalOAuthTokenRequestError(undefined);
  }
  return { accessToken: response.access_token, expiresIn: response.expires_in };
}

function createOAuthAccessTokenProvider(input: {
  readonly authentication: OAuthClientCredentialsAuthentication;
  readonly baseUrl: string;
  readonly fetchImplementation: typeof globalThis.fetch;
  readonly timeoutMs: number;
}): () => Promise<string> {
  const tokenEndpoint = new URL(
    input.authentication.tokenEndpoint ?? '/oauth/token',
    input.baseUrl,
  );
  const leewayMilliseconds = (input.authentication.refreshLeewaySeconds ?? 30) * 1_000;
  let cached: CachedOAuthAccessToken | undefined;
  let inFlight: Promise<string> | undefined;

  const requestAccessToken = async (): Promise<string> => {
    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    if (input.authentication.scopes?.length) {
      body.set('scope', input.authentication.scopes.join(' '));
    }
    const authorization = globalThis.btoa(
      `${input.authentication.clientId}:${input.authentication.clientSecret}`,
    );
    let response: Response;
    try {
      response = await input.fetchImplementation(tokenEndpoint, {
        body,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${authorization}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': `@meshfiscal/sdk/${SDK_VERSION}`,
        },
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(input.timeoutMs),
      });
    } catch {
      throw new MeshFiscalOAuthTokenRequestError(undefined);
    }
    if (!response.ok) {
      throw new MeshFiscalOAuthTokenRequestError(response.status);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MeshFiscalOAuthTokenRequestError(response.status);
    }
    const token = parseOAuthTokenResponse(payload);
    const ttlMilliseconds = token.expiresIn * 1_000;
    cached = {
      accessToken: token.accessToken,
      refreshAt: Date.now() + ttlMilliseconds - Math.min(leewayMilliseconds, ttlMilliseconds - 1),
    };
    return token.accessToken;
  };

  return async () => {
    if (cached && Date.now() < cached.refreshAt) {
      return cached.accessToken;
    }
    if (!inFlight) {
      inFlight = requestAccessToken().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };
}

export function createMeshFiscalClient(options: MeshFiscalClientOptions): MeshFiscalClient {
  assertServerRuntime();
  validateOptions(options);

  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const staticAuthorization = options.authentication?.apiKey ?? options.authentication?.accessToken;
  const oauthAccessToken = options.authentication?.oauthClientCredentials
    ? createOAuthAccessTokenProvider({
        authentication: options.authentication.oauthClientCredentials,
        baseUrl: options.baseUrl,
        fetchImplementation,
        timeoutMs,
      })
    : undefined;

  const transport: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (new URL(request.url).origin !== new URL(options.baseUrl).origin) {
      throw new TypeError('SDK requests must use the configured API origin');
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
    signal.throwIfAborted();
    const headers = new Headers(request.headers);
    const requestId = headers.get('X-Request-Id') ?? createRequestId();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new TypeError('X-Request-Id must be a UUIDv7');
    }
    headers.set('X-Request-Id', requestId);
    headers.set('User-Agent', `@meshfiscal/sdk/${SDK_VERSION}`);
    const authorization = oauthAccessToken
      ? await abortable(oauthAccessToken(), signal)
      : staticAuthorization;
    if (authorization) headers.set('Authorization', `Bearer ${authorization}`);

    const safe = ['GET', 'HEAD'].includes(request.method);
    const maxAttempts = safe ? (options.retry?.maxAttempts ?? 1) : 1;
    const initialDelay = options.retry?.initialDelayMs ?? 250;
    const maxDelay = options.retry?.maxDelayMs ?? 5_000;
    for (let attempt = 1; ; attempt += 1) {
      signal.throwIfAborted();
      let response: Response;
      try {
        response = await abortable(
          fetchImplementation(new Request(request.clone(), { headers, redirect: 'error', signal })),
          signal,
        );
      } catch (cause) {
        if (signal.aborted || attempt >= maxAttempts) throw cause;
        await delay(Math.min(maxDelay, initialDelay * 2 ** (attempt - 1)), signal);
        continue;
      }
      if (attempt >= maxAttempts || ![429, 502, 503, 504].includes(response.status))
        return response;
      const retryAfter = retryAfterMilliseconds(response.headers.get('Retry-After'));
      if (retryAfter !== null && retryAfter > maxDelay) return response;
      await response.body?.cancel();
      await delay(retryAfter ?? Math.min(maxDelay, initialDelay * 2 ** (attempt - 1)), signal);
    }
  };

  return createClient<paths>({
    baseUrl: options.baseUrl.replace(/\/$/, ''),
    fetch: transport,
  });
}

const ARTIFACT_CONTENT_TYPES = new Set<ArtifactDownload['contentType']>([
  'application/json',
  'application/pdf',
  'application/xml',
  'text/xml',
]);

function artifactDownloadMetadata(response: Response): Omit<ArtifactDownload, 'body'> {
  const cacheDirectives = new Set(
    (response.headers.get('cache-control') ?? '')
      .toLowerCase()
      .split(',')
      .map((value) => value.trim()),
  );
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const contentLength = response.headers.get('content-length') ?? '';
  const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0]?.trim();
  const digestMatch = /^sha-256=([A-Za-z0-9+/]{43}=)$/.exec(response.headers.get('digest') ?? '');
  const fileNameMatch = /^attachment; filename="([a-z0-9_]{1,64}\.(?:xml|pdf|json))"$/.exec(
    contentDisposition,
  );
  if (
    !cacheDirectives.has('private') ||
    !cacheDirectives.has('no-store') ||
    response.headers.has('content-encoding') ||
    !/^[1-9]\d*$/.test(contentLength) ||
    !contentType ||
    !ARTIFACT_CONTENT_TYPES.has(contentType as ArtifactDownload['contentType']) ||
    !digestMatch ||
    !fileNameMatch
  ) {
    throw new MeshFiscalArtifactIntegrityError();
  }
  const digestBase64 = digestMatch[1]!;
  const fileName = fileNameMatch[1]!;
  const digestBytes = Buffer.from(digestBase64, 'base64');
  if (
    digestBytes.byteLength !== 32 ||
    digestBytes.toString('base64') !== digestBase64 ||
    response.headers.get('etag') !== `"${digestBytes.toString('hex')}"`
  ) {
    throw new MeshFiscalArtifactIntegrityError();
  }
  const extension = fileName.split('.').at(-1);
  if (
    (contentType === 'application/pdf' && extension !== 'pdf') ||
    (contentType === 'application/json' && extension !== 'json') ||
    (['application/xml', 'text/xml'].includes(contentType) && extension !== 'xml')
  ) {
    throw new MeshFiscalArtifactIntegrityError();
  }
  return Object.freeze({
    contentType: contentType as ArtifactDownload['contentType'],
    fileName,
    sha256: digestBytes.toString('hex'),
    sizeBytes: BigInt(contentLength),
  });
}

function verifiedArtifactBody(
  source: ReadableStream<Uint8Array>,
  metadata: Omit<ArtifactDownload, 'body'>,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const hash = createHash('sha256');
  let receivedBytes = 0n;
  let completed = false;
  return new ReadableStream<Uint8Array>({
    async cancel(reason) {
      await reader.cancel(reason);
    },
    async pull(controller) {
      if (completed) return;
      try {
        const chunk = await reader.read();
        if (!chunk.done) {
          receivedBytes += BigInt(chunk.value.byteLength);
          if (receivedBytes > metadata.sizeBytes) {
            completed = true;
            await reader.cancel();
            controller.error(new MeshFiscalArtifactIntegrityError());
            return;
          }
          hash.update(chunk.value);
          controller.enqueue(chunk.value);
          return;
        }
        completed = true;
        if (receivedBytes !== metadata.sizeBytes || hash.digest('hex') !== metadata.sha256) {
          controller.error(new MeshFiscalArtifactIntegrityError());
          return;
        }
        controller.close();
      } catch {
        completed = true;
        controller.error(new MeshFiscalArtifactIntegrityError());
      }
    },
  });
}

export async function downloadArtifactContent(
  client: MeshFiscalClient,
  locator: ArtifactLocator,
  options: DownloadArtifactOptions = {},
): Promise<ArtifactDownload> {
  const result = await client.GET(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/artifacts/{artifactId}/content',
    {
      params: { path: locator },
      parseAs: 'stream',
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!result.data) {
    throw new MeshFiscalArtifactDownloadRequestError(result.response?.status);
  }
  const metadata = artifactDownloadMetadata(result.response);
  return Object.freeze({
    ...metadata,
    body: verifiedArtifactBody(result.data, metadata),
  });
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
}

export function preferWait(seconds: number): `wait=${number}` {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 10) {
    throw new TypeError('Prefer wait seconds must be an integer from 0 to 10');
  }
  return `wait=${String(seconds)}` as `wait=${number}`;
}

export function nfeIdempotencyKey(reference: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,123}$/.test(reference)) {
    throw new TypeError('NF-e idempotency reference must contain 1 to 124 safe ASCII characters');
  }
  return `nfe:${reference}`;
}

export function dfeIdempotencyKey(reference: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,123}$/.test(reference)) {
    throw new TypeError('DF-e idempotency reference must contain 1 to 124 safe ASCII characters');
  }
  return `dfe:${reference}`;
}

function versionEtag(version: string | bigint): `"${string}"` {
  const value = String(version);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new TypeError('DF-e resource version must be a canonical positive integer');
  }
  return `"${value}"`;
}

export function createNfeBatchChunks(
  payloads: readonly NfeDraftPayload[],
  maximumItems = 50,
): readonly (readonly NfeDraftPayload[])[] {
  if (!Number.isSafeInteger(maximumItems) || maximumItems < 1 || maximumItems > 50) {
    throw new TypeError('maximumItems must be an integer from 1 to 50');
  }
  if (payloads.length < 1) {
    throw new TypeError('NF-e batch requires at least one payload');
  }
  const chunks: NfeDraftPayload[][] = [];
  for (let index = 0; index < payloads.length; index += maximumItems) {
    chunks.push(Object.freeze(payloads.slice(index, index + maximumItems)) as NfeDraftPayload[]);
  }
  return Object.freeze(chunks);
}

function nfeFailure(value: unknown, status: number | undefined): MeshFiscalNfeRequestError {
  return new MeshFiscalNfeRequestError(status, problemDetails(value));
}

export async function submitNfe(
  client: MeshFiscalClient,
  locator: NfeTenantLocator,
  payload: NfeDraftPayload,
  options: SubmitNfeOptions,
): Promise<NfeCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) {
    throw nfeFailure(response.error, response.response?.status);
  }
  return response.data as unknown as NfeCommand;
}

export async function submitNfeBatch(
  client: MeshFiscalClient,
  locator: NfeTenantLocator,
  payloads: readonly NfeDraftPayload[],
  options: SubmitNfeBatchOptions,
): Promise<NfeBatch> {
  const [chunk, overflow] = createNfeBatchChunks(payloads);
  if (!chunk || overflow) {
    throw new TypeError('submitNfeBatch accepts at most 50 payloads; submit each generated chunk');
  }
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe/batches',
    {
      body: { items: chunk },
      params: {
        header: { 'Idempotency-Key': options.idempotencyKey },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) {
    throw nfeFailure(response.error, response.response?.status);
  }
  return response.data as unknown as NfeBatch;
}

export async function submitNfeCancellation(
  client: MeshFiscalClient,
  locator: NfeDocumentLocator,
  payload: NfeCancellationPayload,
  options: SubmitNfeCommandOptions,
): Promise<NfeEventCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe/{documentId}/cancellations',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw nfeFailure(response.error, response.response?.status);
  return response.data as unknown as NfeEventCommand;
}

export async function submitNfeCorrectionLetter(
  client: MeshFiscalClient,
  locator: NfeDocumentLocator,
  payload: NfeCorrectionLetterPayload,
  options: SubmitNfeCommandOptions,
): Promise<NfeEventCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe/{documentId}/correction-letters',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw nfeFailure(response.error, response.response?.status);
  return response.data as unknown as NfeEventCommand;
}

export async function submitNfeIssuerEvent(
  client: MeshFiscalClient,
  locator: NfeDocumentLocator,
  payload: NfeIssuerEventPayload,
  options: SubmitNfeCommandOptions,
): Promise<NfeEventCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe/{documentId}/events',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw nfeFailure(response.error, response.response?.status);
  return response.data as unknown as NfeEventCommand;
}

export async function submitNfeNumberInvalidation(
  client: MeshFiscalClient,
  locator: NfeTenantLocator,
  payload: NfeNumberInvalidationPayload,
  options: SubmitNfeCommandOptions,
): Promise<NfeNumberInvalidationCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe-number-invalidations',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw nfeFailure(response.error, response.response?.status);
  return response.data as unknown as NfeNumberInvalidationCommand;
}

export async function submitNfeDanfe(
  client: MeshFiscalClient,
  locator: NfeDocumentLocator,
  payload: NfeDanfePayload,
  options: SubmitNfeCommandOptions,
): Promise<NfeDanfeCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe/{documentId}/danfe',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw nfeFailure(response.error, response.response?.status);
  return response.data;
}

export async function activateNfeContingency(
  client: MeshFiscalClient,
  locator: NfeDocumentLocator,
  payload: NfeContingencyPayload,
  options: ActivateNfeContingencyOptions,
): Promise<NfeContingency> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe/{documentId}/contingency',
    {
      body: payload,
      params: {
        header: { 'Idempotency-Key': options.idempotencyKey },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw nfeFailure(response.error, response.response?.status);
  return response.data as unknown as NfeContingency;
}

export async function submitNfeContingencyReconciliation(
  client: MeshFiscalClient,
  locator: NfeDocumentLocator,
  options: SubmitNfeCommandOptions,
): Promise<NfeContingencyCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfe/{documentId}/contingency/reconcile',
    {
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw nfeFailure(response.error, response.response?.status);
  return response.data;
}

function dfeFailure(value: unknown, status: number | undefined): MeshFiscalDfeRequestError {
  return new MeshFiscalDfeRequestError(status, problemDetails(value));
}

export async function createDistributionSubscription(
  client: MeshFiscalClient,
  locator: DfeTenantLocator,
  payload: CreateDistributionSubscriptionPayload,
  options: DfeIdempotentOptions,
): Promise<DistributionSubscription> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/distribution-subscriptions',
    {
      body: payload,
      params: {
        header: { 'Idempotency-Key': options.idempotencyKey },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw dfeFailure(response.error, response.response?.status);
  return response.data;
}

export async function updateDistributionSubscription(
  client: MeshFiscalClient,
  locator: DfeSubscriptionLocator,
  payload: UpdateDistributionSubscriptionPayload,
  options: DfeVersionedOptions,
): Promise<DistributionSubscription> {
  const response = await client.PATCH(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/distribution-subscriptions/{subscriptionId}',
    {
      body: payload,
      params: {
        header: { 'If-Match': versionEtag(options.version) },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw dfeFailure(response.error, response.response?.status);
  return response.data;
}

export async function submitDistributionQuery(
  client: MeshFiscalClient,
  locator: DfeTenantLocator,
  payload: DistributionQueryPayload,
  options: SubmitDfeCommandOptions,
): Promise<DistributionQueryCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/distribution-queries',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw dfeFailure(response.error, response.response?.status);
  return response.data;
}

export async function submitRecipientEvent(
  client: MeshFiscalClient,
  locator: DfeTenantLocator,
  payload: RecipientEventPayload,
  options: SubmitDfeCommandOptions,
): Promise<RecipientEventCommand> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/recipient-events',
    {
      body: payload,
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          ...(options.preferWaitSeconds === undefined
            ? {}
            : { Prefer: preferWait(options.preferWaitSeconds) }),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw dfeFailure(response.error, response.response?.status);
  return response.data;
}

export async function createDistributionCursorRecoveryPlan(
  client: MeshFiscalClient,
  locator: DfeSubscriptionLocator,
  payload: CursorRecoveryPlanPayload,
  options: DfeIdempotentOptions,
): Promise<CursorRecoveryPlan> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/distribution-subscriptions/{subscriptionId}/cursor-recovery-plans',
    {
      body: payload,
      params: {
        header: { 'Idempotency-Key': options.idempotencyKey },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw dfeFailure(response.error, response.response?.status);
  return response.data;
}

export async function confirmDistributionCursorRecoveryPlan(
  client: MeshFiscalClient,
  locator: DfeCursorRecoveryPlanLocator,
  options: SubmitDfeVersionedCommandOptions,
): Promise<CursorRecoveryPlan> {
  const response = await client.POST(
    '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/distribution-subscriptions/{subscriptionId}/cursor-recovery-plans/{planId}/confirm',
    {
      params: {
        header: {
          'Idempotency-Key': options.idempotencyKey,
          'If-Match': versionEtag(options.version),
        },
        path: locator,
      },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );
  if (!response.data) throw dfeFailure(response.error, response.response?.status);
  return response.data;
}

export function verifyWebhookSignature(
  rawBody: string | Uint8Array,
  header: string,
  secret: string | readonly string[],
  tolerance = 300,
): boolean {
  assertServerRuntime();
  if (!Number.isSafeInteger(tolerance) || tolerance < 0 || tolerance > 86_400) {
    throw new TypeError('Webhook signature tolerance must be an integer from 0 to 86400 seconds');
  }
  const secrets = typeof secret === 'string' ? [secret] : [...secret];
  if (
    secrets.length < 1 ||
    secrets.length > 8 ||
    secrets.some((value) => typeof value !== 'string' || value.length < 16 || value.length > 512)
  ) {
    throw new TypeError('Webhook secret is invalid');
  }
  if (
    typeof header !== 'string' ||
    header.length < 7 ||
    header.length > 4_096 ||
    !(typeof rawBody === 'string' || rawBody instanceof Uint8Array)
  ) {
    return false;
  }
  const fields = header.split(',').map((field) => field.trim());
  const timestamps = fields
    .filter((field) => field.startsWith('t='))
    .map((field) => field.slice(2));
  const signatures = fields
    .filter((field) => field.startsWith('v1='))
    .map((field) => field.slice(3));
  if (
    timestamps.length !== 1 ||
    !/^\d{1,12}$/.test(timestamps[0] ?? '') ||
    signatures.length < 1 ||
    signatures.length > 16 ||
    signatures.some((value) => !/^[0-9a-f]{64}$/.test(value))
  ) {
    return false;
  }
  const timestamp = Number(timestamps[0]);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(Date.now() / 1_000) - timestamp) > tolerance
  ) {
    return false;
  }
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : Buffer.from(rawBody);
  let verified = 0;
  for (const candidateSecret of secrets) {
    const expected = createHmac('sha256', candidateSecret)
      .update(`${timestamp}.`, 'utf8')
      .update(body)
      .digest();
    for (const candidateSignature of signatures) {
      const actual = Buffer.from(candidateSignature, 'hex');
      verified |= Number(timingSafeEqual(expected, actual));
    }
  }
  return verified === 1;
}

export async function pollFiscalOperation(
  client: MeshFiscalClient,
  locator: FiscalOperationLocator,
  signal?: AbortSignal,
): Promise<FiscalOperation> {
  const response = await client.GET(
    '/v1/projects/{projectId}/environments/{environment}/fiscal-operations/{operationId}',
    {
      params: {
        ...(locator.organizationId
          ? { header: { 'X-Organization-Id': locator.organizationId } }
          : {}),
        path: {
          environment: locator.environment,
          operationId: locator.operationId,
          projectId: locator.projectId,
        },
      },
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.data) {
    throw new MeshFiscalOperationRequestError(response.response?.status);
  }
  return response.data as unknown as FiscalOperation;
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(abortReason(signal));
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function waitForFiscalOperation(
  client: MeshFiscalClient,
  locator: FiscalOperationLocator,
  options: WaitForFiscalOperationOptions = {},
): Promise<FiscalOperation> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  positiveInteger(timeoutMs, 'timeoutMs');
  positiveInteger(pollIntervalMs, 'pollIntervalMs');
  const maximumInterval = options.maximumPollIntervalMs ?? Math.max(pollIntervalMs, 5_000);
  const factor = options.backoffFactor ?? 2;
  positiveInteger(maximumInterval, 'maximumPollIntervalMs');
  if (maximumInterval < pollIntervalMs || !Number.isFinite(factor) || factor < 1 || factor > 4) {
    throw new TypeError('Polling backoff must be from 1 to 4 with maximum >= initial interval');
  }
  const deadline = Date.now() + timeoutMs;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  let interval = pollIntervalMs;
  try {
    for (;;) {
      signal.throwIfAborted();
      const operation = await pollFiscalOperation(client, locator, signal);
      options.onPoll?.(operation);
      if (['succeeded', 'failed', 'action_required', 'canceled'].includes(operation.status))
        return operation;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new MeshFiscalOperationWaitTimeoutError(locator.operationId);
      await delay(Math.min(interval, remaining), signal);
      interval = Math.min(maximumInterval, Math.ceil(interval * factor));
    }
  } catch (cause) {
    if (timeoutSignal.aborted && !options.signal?.aborted) {
      throw new MeshFiscalOperationWaitTimeoutError(locator.operationId);
    }
    throw cause;
  }
}

function createRequestId(): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(Date.now(), 0, 6);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    if (signal.aborted) onAbort();
  });
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (value === null) return null;
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? seconds * 1_000 : Number.POSITIVE_INFINITY;
  }
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? Math.max(0, instant - Date.now()) : null;
}

export class MeshFiscalRequestError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId: string;
  public constructor(public readonly problem: MeshFiscalProblemDetails) {
    super('MeshFiscal request failed');
    this.name = 'MeshFiscalRequestError';
    this.code = problem.code;
    this.status = problem.status;
    this.requestId = problem.requestId;
  }
}

export function parseMeshFiscalError(value: unknown): MeshFiscalRequestError | null {
  const problem = problemDetails(value);
  return problem ? new MeshFiscalRequestError(problem) : null;
}

export function idempotencyKey(namespace: string, reference: string): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(namespace) ||
    reference.length < 1 ||
    reference.length > 4096
  ) {
    throw new TypeError('Idempotency namespace or reference is invalid');
  }
  return `${namespace}:${createHash('sha256').update(reference, 'utf8').digest('hex')}`;
}

export interface CursorPage<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

export async function* iterateCursor<T>(
  fetchPage: (input: {
    readonly cursor?: string;
    readonly signal?: AbortSignal;
  }) => Promise<CursorPage<T>>,
  options: { readonly signal?: AbortSignal; readonly maximumPages?: number } = {},
): AsyncGenerator<T> {
  const maximum = options.maximumPages ?? 10_000;
  positiveInteger(maximum, 'maximumPages');
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maximum; page += 1) {
    options.signal?.throwIfAborted();
    const result = await fetchPage({
      ...(cursor === undefined ? {} : { cursor }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    options.signal?.throwIfAborted();
    for (const item of result.data) yield item;
    if (result.nextCursor === null) return;
    if (!result.nextCursor || seen.has(result.nextCursor))
      throw new Error('Cursor pagination did not advance');
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('Cursor pagination exceeded maximumPages');
}

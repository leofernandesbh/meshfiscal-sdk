# `@meshfiscal/sdk`

Cliente HTTP tipado, MIT e exclusivamente server-side para a API MeshFiscal. O pacote é gerado do OpenAPI público e oferece helpers seguros de polling para operações duráveis; não contém engine fiscal nem credenciais.

```ts
import { createMeshFiscalClient, waitForFiscalOperation } from '@meshfiscal/sdk';

const meshFiscal = createMeshFiscalClient({
  baseUrl: 'https://api.meshfiscal.com',
  authentication: {
    oauthClientCredentials: {
      clientId: process.env.MESHFISCAL_CLIENT_ID!,
      clientSecret: process.env.MESHFISCAL_CLIENT_SECRET!,
      scopes: ['operations:read'],
    },
  },
});

const { data, error } = await meshFiscal.GET('/health/ready');

const operation = await waitForFiscalOperation(
  meshFiscal,
  { projectId, environment: 'production', operationId },
  { timeoutMs: 15_000, pollIntervalMs: 500 },
);
```

NF-e usa payload tipado com todos os valores decimais como `string`; o SDK nunca os converte
para `number`. Gere uma chave a partir da referência lógica e reutilize exatamente a mesma chave
em qualquer retry. `submitNfe` aplica `Prefer: wait` somente como espera curta, enquanto
`createNfeBatchChunks` separa lotes acima do limite público sem misturar idempotência entre eles:

```ts
import {
  createNfeBatchChunks,
  nfeIdempotencyKey,
  submitNfe,
  submitNfeBatch,
  type NfeDraftPayload,
} from '@meshfiscal/sdk';

const payload = buildPayloadFromErp(erpInvoice) satisfies NfeDraftPayload;

const command = await submitNfe(meshFiscal, { organizationId, projectId, environment: 'production' }, payload, {
  idempotencyKey: nfeIdempotencyKey(`invoice:${erpInvoiceId}`),
  preferWaitSeconds: 5,
});

for (const [index, chunk] of createNfeBatchChunks(payloads).entries()) {
  await submitNfeBatch(meshFiscal, { organizationId, projectId, environment: 'production' }, chunk, {
    idempotencyKey: nfeIdempotencyKey(`batch:${erpBatchId}:${index}`),
  });
}
```

Eventos, inutilização, DANFE e contingência também têm helpers tipados. Eles retornam o
recurso assíncrono e sua `operation` sem iniciar polling oculto; use `waitForFiscalOperation`
explicitamente quando o processo precisar aguardar. O PDF continua sendo baixado pelo helper
íntegro de artefatos usando o `artifactId` retornado pela consulta do DANFE:

```ts
import {
  submitNfeCancellation,
  submitNfeDanfe,
  waitForFiscalOperation,
} from '@meshfiscal/sdk';

const danfe = await submitNfeDanfe(
  meshFiscal,
  { organizationId, projectId, environment: 'production', documentId },
  { format: 'portrait' },
  { idempotencyKey: nfeIdempotencyKey(`danfe:${documentId}`), preferWaitSeconds: 5 },
);

await waitForFiscalOperation(meshFiscal, {
  projectId,
  environment: 'production',
  operationId: danfe.operation.id,
});

await submitNfeCancellation(
  meshFiscal,
  { organizationId, projectId, environment: 'production', documentId },
  { protocolNumber, justification: 'Operação cancelada antes da circulação da mercadoria' },
  { idempotencyKey: nfeIdempotencyKey(`cancel:${documentId}`) },
);
```

Distribuição DF-e mantém consulta, manifestação e recuperação de cursor como comandos separados.
`submitRecipientEvent` exige o tipo escolhido pelo cliente; nenhum helper infere manifestação.
Automação de Ciência da Operação só é habilitada por update versionado com consentimento explícito,
e a recuperação de cursor permanece em duas etapas (`dryRun` e confirmação por versão):

```ts
import {
  createDistributionCursorRecoveryPlan,
  dfeIdempotencyKey,
  submitDistributionQuery,
  submitRecipientEvent,
  updateDistributionSubscription,
} from '@meshfiscal/sdk';

await submitDistributionQuery(
  meshFiscal,
  { organizationId, projectId, environment: 'production' },
  { kind: 'latest_nsu', requestedNsu: lastPersistedNsu, subscriptionId },
  { idempotencyKey: dfeIdempotencyKey(`query:${subscriptionId}:${lastPersistedNsu}`) },
);

await submitRecipientEvent(
  meshFiscal,
  { organizationId, projectId, environment: 'production' },
  { details: {}, receivedDfeId, sequence: 1, type: 'operation_acknowledgement' },
  { idempotencyKey: dfeIdempotencyKey(`ack:${receivedDfeId}`) },
);

await updateDistributionSubscription(
  meshFiscal,
  { organizationId, projectId, environment: 'production', subscriptionId },
  {
    automationPolicy: 'acknowledge_operation',
    automationRiskAcknowledged: true,
    certificateId,
    status: 'active',
  },
  { version: subscription.version },
);

const plan = await createDistributionCursorRecoveryPlan(
  meshFiscal,
  { organizationId, projectId, environment: 'production', subscriptionId },
  { dryRun: true, proposedLastNsu, reason: 'Recuperação revisada pelo responsável fiscal.' },
  { idempotencyKey: dfeIdempotencyKey(`cursor:${subscriptionId}:${proposedLastNsu}`) },
);
// Confirme o plano em uma ação humana separada com plan.id e plan.version.
```

Valide webhooks sobre o corpo bruto recebido, antes de fazer `JSON.parse`. O helper aceita
as múltiplas assinaturas `v1` emitidas durante o overlap de rotação e, opcionalmente, uma
lista curta de secrets conhecidos:

```ts
import { verifyWebhookSignature } from '@meshfiscal/sdk';

const valid = verifyWebhookSignature(
  rawRequestBody,
  request.headers['meshfiscal-signature'] ?? '',
  [process.env.MESHFISCAL_WEBHOOK_SECRET_CURRENT!, process.env.MESHFISCAL_WEBHOOK_SECRET_PREVIOUS!],
  300,
);
```

Além da janela temporal, deduplique o `MeshFiscal-Event-Id` no seu armazenamento para
proteção contra replay e processamento at-least-once.

Billing e uso continuam sendo consultados pela API MeshFiscal, sem leitura Stripe no
integrador. Os tipos `BillingPlan`, `BillingSubscription`, `UsageQuota` e `UsageEffect`
são exportados diretamente. `getUsageQuotaUnits` converte os inteiros decimais de quota
para `bigint` sem IEEE-754, e `parseCommercialAccessError` classifica apenas os códigos
estáveis de entitlement e quota:

```ts
import {
  getUsageQuotaUnits,
  MeshFiscalEntitlementError,
  parseCommercialAccessError,
} from '@meshfiscal/sdk';

const response = await meshFiscal.GET(
  '/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/usage/quota',
  { params: { path: { organizationId, projectId, environment: 'production' } } },
);

if (response.error) {
  const commercialError = parseCommercialAccessError(response.error);
  if (commercialError instanceof MeshFiscalEntitlementError) {
    // Atualize a assinatura pelo fluxo MeshFiscal; não consulte Stripe para autorizar.
  }
}

const units = response.data?.data ? getUsageQuotaUnits(response.data.data) : null;
```

Artefatos podem ser consultados pelas rotas tipadas e baixados sem buffering pelo helper seguro.
Ele exige resposta `private, no-store`, MIME/filename allowlisted, tamanho, `Digest` e `ETag`
coerentes; o stream falha no final se os bytes não produzirem o SHA-256 declarado:

```ts
import { downloadArtifactContent } from '@meshfiscal/sdk';

const artifact = await downloadArtifactContent(meshFiscal, {
  organizationId,
  projectId,
  environment: 'production',
  artifactId,
});

for await (const chunk of artifact.body) {
  await destination.write(chunk);
}
```

O SDK aceita exatamente um provider por cliente: `{ apiKey }`, `{ accessToken }`
para o control plane humano, ou `{ oauthClientCredentials }`. O provider OAuth usa
`client_secret_basic`, mantém o access token somente em memória, antecipa a renovação
e deduplica aquisições concorrentes; nunca solicita nem aceita `refresh_token`.
`projectId` e `environment` são sempre explícitos nos helpers de operação. Para sessão
humana, informe também `organizationId`; credenciais M2M derivam a organização do
principal autenticado.

Não embarque API keys ou tokens em navegador, mobile, Electron renderer ou código distribuído ao cliente. Publicação npm e provenance permanecem desativados até a fase prevista.


## F20: transporte, paginação e compatibilidade

Pacote `0.1.0` preparado para publicação; não confunda o tarball local com uma versão disponível no npm. Use exclusivamente em Node server-side. Browser, Web Worker, Electron renderer e React Native não são suportados; segredos ficam no backend. Node 22.23.3 e 24.19.0 são as bases da matriz em `compatibility.json`; contratos 1.0.0 e 1.1.0/OpenAPI 3.0.3 e servidor 0.1.0. A matriz usa a baseline F19 d47145e e o servidor atual, com o mesmo tarball.

`timeoutMs` limita a chamada inteira, incluindo espera de token OAuth e retries. Cada consumidor do cache single-flight pode cancelar sua espera sem cancelar o token compartilhado. `fetchImplementation` aceita transporte customizado; requests sempre usam a origem de `baseUrl`, redirects são recusados e HTTP é permitido somente em loopback. Artefatos mantêm cancelamento durante o streaming; uma leitura só está íntegra após consumir o corpo até o fim.

Retry automático é opt-in, com até quatro tentativas somente para GET/HEAD e status 429/502/503/504 ou falha de rede. POST/PUT/PATCH/DELETE não são repetidos pelo transporte. Para comandos, conserve `Idempotency-Key` e reconcilie resultados desconhecidos. `Retry-After` maior que o limite retorna a resposta ao chamador; o SDK não antecipa a próxima tentativa. UUIDv7 `X-Request-Id` é criado uma vez por chamada ou preservado quando fornecido.

```ts
import { createMeshFiscalClient, idempotencyKey, iterateCursor, parseMeshFiscalError } from '@meshfiscal/sdk';

const client = createMeshFiscalClient({
  baseUrl: process.env.MESHFISCAL_BASE_URL!,
  authentication: { apiKey: process.env.MESHFISCAL_API_KEY! },
  timeoutMs: 10_000,
  retry: { maxAttempts: 3, initialDelayMs: 250, maxDelayMs: 5_000 },
});
const key = idempotencyKey('nfse', 'ERP-pedido-100'); // conserve junto ao pedido
void key;
for await (const document of iterateCursor(async ({ cursor, signal }) => {
  const response = await client.GET('/v1/organizations/{organizationId}/projects/{projectId}/environments/{environment}/nfce', {
    params: { path: { organizationId, projectId, environment: 'sandbox' }, query: { ...(cursor ? { cursor } : {}), limit: 20 } },
    ...(signal ? { signal } : {}),
  });
  if (!response.data) throw parseMeshFiscalError(response.error);
  return response.data;
}, { maximumPages: 100 })) {
  // Persista apenas a projeção necessária no backend.
  void document.id;
}
```

O iterador detecta cursor repetido/ausente e limita páginas. `waitForFiscalOperation` usa backoff exponencial limitado; `outcome_unknown` requer reconciliação e não é sucesso. Ajuste `pollIntervalMs`, `maximumPollIntervalMs`, `backoffFactor` e `signal` explicitamente.

`paths`, `operations` e `components` expõem o contrato público completo, incluindo NFC-e/NFS-e, estados e Problem Details. Decimais continuam strings; `getUsageQuotaUnits` usa bigint apenas para contadores inteiros. `parseMeshFiscalError` preserva status/código/requestId com mensagem genérica. Webhook deve usar bytes originais e segredo server-side, tolerância temporal e persistência do eventId para deduplicação.

## Distribuição e manutenção

Exports condicionais ESM/CJS com declarations próprias; `sideEffects: false`. Allowlist inclui somente runtime/tipos, README, MIT, NOTICE, CHANGELOG e matriz. Engine fiscal, testes, sourcemaps, fixtures, segredos e rotas internas não são distribuídos. `pnpm run sdk:verify` instala o tarball em consumidores isolados ESM/CJS/TypeScript e testa a API efêmera, SBOM e assinatura das dependências npm.

SemVer e Changesets governam incrementos. Deprecações têm substituto/owner, janela de 180 dias, `Deprecation`/`Sunset`/`Link` na API e changelog; nenhuma está ativa em 0.1.0. Release real exige revisão e autorização específica, trusted publisher GitHub/npm e provenance verificada após publicação. Dry-run não publica nem produz provenance real.

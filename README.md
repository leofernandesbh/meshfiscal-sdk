# MeshFiscal SDK MIT

Fonte independente do cliente Node server-side `@meshfiscal/sdk`. Documentação de uso em `apps/sdk/README.md`, contrato público em `openapi/meshfiscal-public-v1.openapi.json`. Runtime, tipos públicos, testes e tooling desta exportação são MIT; licenças das dependências estão no NOTICE e nos pacotes respectivos.

## Desenvolvimento

Use Node 24.19.0 e npm 11.21.0. Execute `npm ci --ignore-scripts`, `npm run build`, `npm run typecheck` e `npm test`. Os tipos gerados são um snapshot do contrato público; atualizações chegam pela exportação revisada da fonte canônica MeshFiscal. Não editar os tipos gerados manualmente.

## Release

Workflow manual `sdk-release.yml` na branch `main`: versão e SHA-256 precisam coincidir com o tarball revisado e testado contra os servidores suportados. `publish=false` recompila, verifica consumidores e preserva pacote/SBOM; `publish=true` depende de revisão no environment `npm-release` e trusted publisher npm OIDC deste repositório público. Configure reviewers e proteção da branch antes de habilitar publicação. Nenhum token npm longo é necessário. O repositório e o pacote devem ser públicos para provenance.

Para a primeira versão, a propriedade do scope e o bootstrap autorizado do pacote são pré-condições. Não tratar um pacote preparado como publicado. Após publicação, verificar integrity, assinaturas e provenance do registry e registrar commit/run público. A matriz em `apps/sdk/compatibility.json` registra as versões efetivamente exercitadas na fonte canônica; o workflow público também executa os 71 testes do SDK e consumidores ESM/CJS/TypeScript.

## Versão publicada

[`@meshfiscal/sdk@0.1.0`](https://www.npmjs.com/package/@meshfiscal/sdk/v/0.1.0) está publicado com OIDC/provenance. Instale com `npm install @meshfiscal/sdk@0.1.0`. A [release v0.1.0](https://github.com/leofernandesbh/meshfiscal-sdk/releases/tag/v0.1.0) contém tarball, recibo, SBOM, assinaturas e verificação criptográfica dos atestados.

Fonte publicada: `0967d6a001dbbe446a3fc5d974e2d06156d68bd7`. SHA-256 do tarball: `8f3cc6efa8eab9139b9f81a58b7927414d2ef5edca45a3130db31f14be6cdfd7`. A verificação independente do registry passou sem repetir publicação. Para verificar uma versão existente, use `verify_registry=true,publish=false`; esse modo não publica nem solicita OIDC.

O README incluído no pacote 0.1.0 preserva um aviso histórico de preparação anterior à publicação. O estado vigente é o desta página e da release; os bytes da versão publicada são imutáveis. Esse texto será atualizado no pacote na próxima release adequada.

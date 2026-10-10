# MeshFiscal SDK MIT

Fonte independente do cliente Node server-side `@meshfiscal/sdk`. Documentação de uso em `apps/sdk/README.md`, contrato público em `openapi/meshfiscal-public-v1.openapi.json`. Runtime, tipos públicos, testes e tooling desta exportação são MIT; licenças das dependências estão no NOTICE e nos pacotes respectivos.

## Desenvolvimento

Use Node 24.19.0 e npm 11.21.0. Execute `npm ci --ignore-scripts`, `npm run build`, `npm run typecheck` e `npm test`. Os tipos gerados são um snapshot do contrato público; atualizações chegam pela exportação revisada da fonte canônica MeshFiscal. Não editar os tipos gerados manualmente.

## Release

Workflow manual `sdk-release.yml` na branch `main`: versão e SHA-256 precisam coincidir com o tarball revisado e testado contra os servidores suportados. `publish=false` recompila, verifica consumidores e preserva pacote/SBOM; `publish=true` depende de revisão no environment `npm-release` e trusted publisher npm OIDC deste repositório público. Configure reviewers e proteção da branch antes de habilitar publicação. Nenhum token npm longo é necessário. O repositório e o pacote devem ser públicos para provenance.

Para a primeira versão, a propriedade do scope e o bootstrap autorizado do pacote são pré-condições. Não tratar um pacote preparado como publicado. Após publicação, verificar integrity, assinaturas e provenance do registry e registrar commit/run público. A matriz em `apps/sdk/compatibility.json` registra as versões efetivamente exercitadas na fonte canônica; o workflow público também executa os 71 testes do SDK e consumidores ESM/CJS/TypeScript.

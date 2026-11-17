# 012 — `npm audit`, hooks de pre-commit e CI

Status: **implementado em 2026-11-17**, aprovado com as três propostas das perguntas (ver "Decisões")
Branch: `chore/audit-and-ci`

## Objetivo

Fechar duas pendências do `CLAUDE.md`:

- **`npm audit`:** zerar os 10 avisos moderados.
- **CI e hooks de pre-commit:** lint, typecheck e testes rodando sozinhos, em vez de só à mão.

## Diagnóstico do `npm audit` (2026-11-17)

Os 10 avisos são uma única falha: **`minimatch` 10.x** (negação de serviço por padrões de glob, corrigida na `>=11.0.1`). Ela chega por dois caminhos, ambos em ferramentas de desenvolvimento; nada disso vai para o código que roda no app.

| Caminho                                                                                                         | Avisos | Correção disponível                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eslint-config-next` → `typescript-eslint` 8.72.2 → `@typescript-eslint/typescript-estree` → `minimatch` 10.2.6 | 6      | **Sim, sem quebra.** O `typescript-eslint` 8.73.0 (já dentro da faixa `^8.56.0` do `eslint-config-next`) usa `minimatch ^11.0.1`. Basta atualizar o lockfile (`npm update typescript-eslint`).                                                                                                                                       |
| `shadcn` 4.23.0 → `ts-morph` 26 → `@ts-morph/common` 0.27 → `minimatch` 10.2.6                                  | 4      | **Não pelo caminho normal.** O `shadcn` 4.23.0 já é o mais novo e ainda usa o `ts-morph` 26. O "fix" que o `npm audit` sugere é instalar o `shadcn` **1.0.0**, um downgrade de três versões maiores (por isso a regra de nunca usar `npm audit fix --force`). O `ts-morph` 28 / `@ts-morph/common` 0.29 já usam `minimatch ^11.0.1`. |

O `shadcn` só roda quando adicionamos um componente novo (`npx shadcn add ...`), sobre arquivos do próprio projeto; o risco prático é baixo. Mesmo assim, dá para corrigir sem esperar (pergunta 1).

## Escopo

### 1. `npm audit` zerado

- **Caminho do `typescript-eslint`:** `npm update typescript-eslint` (só o lockfile muda).
- **Caminho do `shadcn`:** um `overrides` no `package.json` que força o `minimatch` corrigido só dentro do `@ts-morph/common`:
  ```json
  "overrides": { "@ts-morph/common": { "minimatch": "^11.0.1" } }
  ```
  O `@ts-morph/common` 0.27 pede `^10.0.1`; a 11 mantém a mesma API (`minimatch(path, pattern)` e a classe `Minimatch`), que é o que a versão 0.29 do próprio `ts-morph` já usa com a 11. Conferência: `npx shadcn add` de um componente que já existe, com `--dry-run`, e `npx shadcn diff`, para provar que a CLI continua funcionando.
- **Resultado esperado:** `npm audit` com 0 avisos.
- Quando o `shadcn` passar a usar o `ts-morph` 28, o `overrides` pode sair (anotado no `CLAUDE.md`).

### 2. Hook de pre-commit (local)

- **Sem dependência nova** (nada de Husky ou lint-staged): um script de shell versionado em `.githooks/pre-commit`, e o Git configurado para usar essa pasta com `git config core.hooksPath .githooks`.
- **Configuração automática:** um script `prepare` no `package.json` roda esse `git config` em todo `npm install`. Num clone novo, o hook já vem ligado.
- **O que roda, nesta ordem, parando no primeiro erro:**
  1. `npm run format:check` (Prettier, ~5 s)
  2. `npm run lint` (~14 s)
  3. `npm run typecheck` (~7 s)
  4. `npx vitest run --project unit` (testes de unidade, ~7 s)

  Total medido: cerca de 33 s. Os testes de integração e os e2e ficam de fora do hook, porque precisam do banco no Docker e levam minutos; eles rodam no CI.

- **Mensagem clara:** se algo falhar, o hook diz qual etapa falhou e como pular em emergência (`git commit --no-verify`). O `CLAUDE.md` passa a dizer que pular o hook não é o padrão.
- **No Windows:** o Git for Windows roda o hook com o próprio `sh`, como já acontece hoje com os comandos do projeto.

### 3. CI (GitHub Actions)

- **Hoje não há repositório remoto** (`git remote -v` vazio), então o CI fica pronto e versionado, mas só passa a rodar quando o projeto for publicado no GitHub. Publicar não faz parte deste plano.
- **`.github/workflows/ci.yml`**, disparado em `push` e `pull_request`, com Node 26 (lido do `.nvmrc`) e cache do npm:
  - **Job `checks`:** `npm ci`, `format:check`, `lint`, `typecheck`, testes de unidade e `npm audit --audit-level=moderate` (falha se aparecer qualquer aviso moderado ou pior).
  - **Job `tests`:** Postgres 18 como serviço (mesma imagem do `docker-compose.yml`), cria o banco `prumo_test`, escreve um `.env.test` com credenciais descartáveis do próprio CI (não são segredos: o banco só existe durante o job), roda `npm test` (unidade + integração) e depois `npm run test:e2e` com o Chromium do Playwright. Em caso de falha, guarda o relatório do Playwright como artefato.
- **Sem segredos no repositório:** o workflow não precisa de nenhuma chave.

## Fora de escopo

- Criar o repositório remoto ou fazer push (o `CLAUDE.md` exige pedido explícito).
- Hook de pre-push, commit message lint ou checagem de Conventional Commits.
- Deploy automático (pendência separada).
- Trocar o `shadcn` ou o `ts-morph` de versão diretamente.

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
package.json, package-lock.json     (overrides, script prepare)
.githooks/pre-commit                (novo)
.github/workflows/ci.yml            (novo)
CLAUDE.md                           (Comandos, Workflow, Pendências)
```

## Testes e conferência

Não há regra de negócio nova, então não há testes de unidade novos. A conferência é feita rodando de verdade:

- `npm audit` com 0 avisos; `npx shadcn diff` e `npx shadcn add button --dry-run` funcionando.
- **Hook:** um commit com um arquivo fora do padrão do Prettier é **barrado** com a mensagem da etapa; depois de formatar, o commit passa. Também confiro que `npm install` liga o hook (`git config core.hooksPath` devolve `.githooks`).
- **CI:** sem remoto não dá para rodar no GitHub. Valido a sintaxe do YAML e reproduzo localmente a sequência do job `tests` (criar `.env.test` do zero numa pasta temporária não, mas rodar os mesmos comandos na ordem do workflow). Quando o projeto for para o GitHub, a primeira execução confirma o resto.
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.

## Critério de pronto

- Tudo acima, pendências removidas do `CLAUDE.md` e este plano atualizado.

## Mudanças durante a implementação

- **`DATABASE_URL` no `env` do workflow.** Ao simular o CI sem `.env`, o `prisma generate` (que o `npm ci` roda pelo `postinstall`) falhou: o `prisma.config.ts` exige a variável mesmo sem conectar. O workflow define `DATABASE_URL` uma vez, no topo, apontando para o Postgres do job `tests`; o job `checks` só precisa dela para gerar o cliente. O `.env.test` do CI é escrito a partir da mesma variável.
- **Conferência do `shadcn`:** `npx shadcn add button --dry-run` rodou com o `minimatch` 11 e reconheceu o componente existente como idêntico, sem escrever nada. O `npx shadcn diff` não existe mais na versão 4 (virou a opção `--diff` do `add`), então não foi usado.
- **O hook confere o projeto inteiro**, não só os arquivos do commit (Prettier, lint e typecheck já são rápidos assim, e não há `lint-staged`). Um arquivo mal formatado fora do commit também barra o commit.
- **Teste do hook:** um commit com `src/lib/tmp-bad.ts` mal formatado foi barrado na etapa "formatação (Prettier)", com a mensagem prevista; o arquivo de teste foi removido.
- **Relatório do Playwright:** o projeto usa o reporter `list`, então o artefato do CI em caso de falha é a pasta `test-results/` (traces e capturas); `playwright-report/` fica na lista caso o reporter mude.
- **Resultado:** `npm audit` com 0 avisos; `typescript-eslint` em 8.73.0; `minimatch` 11.0.9 nos dois caminhos.

## Decisões

1. `overrides` do `minimatch` dentro do `@ts-morph/common`.
2. O hook roda Prettier, lint, typecheck e testes de unidade.
3. O workflow do CI foi criado agora, pronto para quando houver remoto no GitHub.

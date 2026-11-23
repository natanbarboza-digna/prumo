# 038 — Hooks e CI mais leves para `docs` e `chore`

Status: **proposto**, aguardando aprovação
Branch: `chore/lighter-hooks`

Pedido do dono do projeto: a suíte de testes roda sempre, até no push de um README (o `pre-push` rodou os 696 testes). Commits de `docs` e `chore` não devem rodar a suíte inteira, nem nos hooks nem no CI (ajuste pedido na revisão do plano).

## Como é hoje (planos 012 e 030)

| Hook         | Quando               | O que roda                                     |
| ------------ | -------------------- | ---------------------------------------------- |
| `pre-commit` | antes de cada commit | Prettier, lint, typecheck e testes de unidade  |
| `commit-msg` | depois da mensagem   | confere a mensagem (Conventional Commits)      |
| `pre-push`   | antes de cada push   | banco no ar, `npm test` completo e `npm audit` |

O `pre-commit` roda **antes** de a mensagem existir, por isso não sabe o tipo do commit.

## Como fica

### Commit (pergunta 1)

- O `pre-commit` fica só com o **Prettier** (rápido e vale para qualquer arquivo, inclusive Markdown).
- Lint, typecheck e testes de unidade passam para o **`commit-msg`**, que já recebe a mensagem: primeiro confere a mensagem, depois decide.
- Commit **`docs`** ou **`chore`**: só a mensagem e o Prettier. Os outros tipos: tudo, como hoje.
- Um hook `commit-msg` que falha também cancela o commit, então nada muda para quem commita além da ordem das mensagens no terminal.

### Push (pergunta 2)

- O `pre-push` lê os commits que vão ser enviados (o Git passa cada branch e o intervalo na entrada do hook; branch nova sem nada no remoto conta os commits que não estão em nenhuma branch remota).
- **Todos** os commits são `docs` ou `chore`: pula o `npm test` e diz "pre-push: só commits de docs e chore; testes pulados". Basta um commit de outro tipo para rodar tudo.
- O **`npm audit`** continua sempre (leva segundos e pode pegar um aviso novo publicado depois do último push).
- O banco só precisa estar no ar quando os testes rodam.

### Exceção de segurança (pergunta 3)

Mesmo em `docs` ou `chore`, roda tudo quando os arquivos do commit (ou do push) incluem:

- `package.json` ou `package-lock.json` (um `chore(deps)` que sobe uma dependência pode quebrar o código);
- `prisma/` (schema ou migration);
- qualquer arquivo em `src/`, `e2e/` ou `scripts/` (um `chore` que mexe em código continua sendo código).

Assim, só pula de verdade o que é documentação ou configuração sem código (README, planos, `.gitignore`, `CLAUDE.md`).

### CI (pergunta 5)

O CI segue a mesma regra dos hooks, sobre os commits do push ou do pull request:

- Um job novo e rápido, **"Escopo"**, roda o mesmo `scripts/hook-scope.ts` sobre o intervalo (o mesmo que o passo "Mensagens de commit" já calcula: `before..sha` no push, base e cabeça no PR, o último commit numa branch nova) e devolve `full` (`true` ou `false`).
- **Sempre rodam** (são rápidos e valem para qualquer commit): mensagens de commit, Prettier e `npm audit`.
- **Só com `full = true`:** lint, tipos e unidade (passos do job de checagens, com `if:`) e o job inteiro de **integração e e2e** (`needs: scope` e `if:`). Quando pulados, o GitHub mostra o job como "skipped", não como falha.
- Na dúvida (intervalo que não dá para ler, como um push forçado que reescreve a história), roda tudo.

Assim, o push do README teria rodado só mensagens, Prettier e `npm audit`, no hook e no CI.

## Fora de escopo

- Pular por outros tipos (`style`, `ci`, `test`): a pergunta 4 decide.
- Escolher no terminal o que roda (variável de ambiente para pular): já existe `--no-verify` para emergência, que o `CLAUDE.md` não recomenda.
- Proteção de branch no GitHub (exigir o CI verde para o merge): não existe hoje e continua fora.

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/lib/hook-scope.ts`** (puro): `isLightCommit(message)` (tipo `docs` ou `chore`, com ou sem escopo e `!`) e `needsFullChecks(messages, files)` (falso só quando todas as mensagens são leves e nenhum arquivo cai na exceção).
- **`scripts/hook-scope.ts`**: lê do Git as mensagens e os arquivos (do commit em andamento, no `commit-msg`; de um intervalo, no `pre-push` e no CI) e sai com 0 (rodar tudo) ou 10 (pular), para os hooks em `sh` e o CI decidirem; no CI, também escreve `full=true|false` em `$GITHUB_OUTPUT`.
- **`.githooks/pre-commit`**, **`.githooks/commit-msg`** e **`.githooks/pre-push`** ajustados.
- **`.github/workflows/ci.yml`:** job `scope`, passos condicionais no job de checagens e condição no job de testes.
- **`CLAUDE.md`**: item 6 do Workflow (o que cada hook roda e quando pula).

## Arquivos afetados

```
src/lib/hook-scope.ts, src/lib/hook-scope.test.ts
scripts/hook-scope.ts
.githooks/pre-commit, .githooks/commit-msg, .githooks/pre-push
.github/workflows/ci.yml
CLAUDE.md
```

## Testes (escritos antes do código, em TDD)

### Unidade (`hook-scope.test.ts`)

- `isLightCommit`: `docs:`, `chore:`, `docs(readme):`, `chore(deps)!:` são leves; `feat:`, `fix:`, `test:` e mensagem fora do padrão não são.
- `needsFullChecks`: só leves e só Markdown → falso; um commit `feat` no meio → verdadeiro; `chore` com `package.json`, `prisma/…`, `src/…`, `e2e/…` ou `scripts/…` → verdadeiro; lista vazia de commits → verdadeiro (na dúvida, roda).

### Manual (registrado no plano)

- Commit `docs` só com Markdown: o terminal mostra só a mensagem e o Prettier.
- Commit `feat`: roda lint, typecheck e unidade.
- Script do `pre-push` com um intervalo só de `docs` (pula os testes, roda o `npm audit`) e com um `feat` no meio (roda tudo), chamado como o Git chama, sem enviar nada.
- `scripts/hook-scope.ts --range` com os mesmos dois intervalos, como o CI chama, conferindo o `full` escrito num `GITHUB_OUTPUT` temporário.
- **CI de verdade:** só dá para ver depois de um push, que é seu. No primeiro push depois do merge (um `docs` ou `chore`), confiro a execução pelo `gh` (só leitura): mensagens, Prettier e audit verdes, o resto "skipped".

## Critério de pronto

- `npm run lint`, `npm run typecheck` e `npm test` passando; os testes manuais acima registrados.
- `npm run container:up` e `npm run container:check` passando (plano 025), mesmo sem mudança no app, como pede a regra.
- `CLAUDE.md` (itens 5 e 6 do Workflow: o que cada hook e o CI rodam e quando pulam) e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **No commit, mover lint, typecheck e unidade para o `commit-msg`** (o único hook que sabe o tipo)? Proposta: sim; o Prettier fica no `pre-commit`.
2. **No push, pular o `npm test` só se todos os commits forem `docs` ou `chore`**, mantendo o `npm audit`? Proposta: sim.
3. **Exceção:** rodar tudo quando `docs`/`chore` mexem em dependências, `prisma/`, `src/`, `e2e/` ou `scripts/`? Proposta: sim.
4. **Só `docs` e `chore`**, ou também `style` e `ci`? Proposta: só os dois que você pediu; `style` mexe em código e `ci` muda o pipeline.
5. **No CI, manter sempre mensagens, Prettier e `npm audit`** e pular o resto com a mesma regra? Proposta: sim, como nos hooks.

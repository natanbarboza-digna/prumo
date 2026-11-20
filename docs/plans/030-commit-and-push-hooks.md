# 030 — Verificação das mensagens de commit e hook de pre-push

Status: **proposto**, aguardando aprovação
Branch: `chore/commit-and-push-hooks`

Plano do grupo Ferramentas. Retoma o que ficou fora do plano 012. O deploy automático pelo CI fica para quando existirem o repositório no GitHub e o VPS (alinhamento do grupo).

## Objetivo

1. **Mensagens de commit:** garantir o padrão Conventional Commits do `CLAUDE.md` na hora do commit, com uma explicação clara quando a mensagem estiver fora dele.
2. **Pre-push:** antes de enviar commits para um remoto, rodar o que o pre-commit deixa de fora por ser lento ou depender do banco.

## 1. Hook `commit-msg`

### Regras (pergunta 1)

A primeira linha segue `tipo(escopo opcional)!opcional: descrição`:

- **Tipo**, em minúsculas: `feat`, `fix`, `test`, `refactor`, `docs`, `chore` (os do `CLAUDE.md`) e também `ci`, `build`, `perf`, `style` e `revert`, os outros do padrão. Isso regulariza o único commit fora da lista até hoje (`0bc3e44 ci: add github actions workflow`).
- **Escopo**, opcional, entre parênteses: letras minúsculas, números e hífen (`feat(pdi): …`).
- **Descrição:** depois de `: `, começando por letra minúscula ou número, sem ponto final.
- **Primeira linha com até 72 caracteres.**
- Se houver corpo, **uma linha em branco** separa a primeira linha dele. O corpo e o rodapé (`Co-Authored-By: …`) são livres.
- Linhas de comentário do Git (`# …`) são ignoradas.

**Passam direto**, porque o próprio Git as escreve: `Merge …`, `Revert "…"`, `fixup! …`, `squash! …` e `amend! …`.

O idioma (inglês) não é verificado: não há como saber de forma confiável sem dependência.

### Mensagem de erro

Em pt-BR, com a primeira linha recusada, o motivo e um exemplo:

```
commit-msg: a mensagem não segue o padrão (Conventional Commits).
  Primeira linha: "Adiciona filtro"
  Motivo: falta o tipo. Use tipo: descrição, por exemplo "feat: add track filter".
  Tipos: feat, fix, test, refactor, docs, chore, ci, build, perf, style, revert.
```

### Como é feito (sem dependência)

- **`src/lib/commit-message.ts`** (puro): `checkCommitMessage(text)` devolve `null` (válida) ou o motivo. Fica em `src/` para os testes de unidade alcançarem.
- **`scripts/check-commit-message.ts`** (rodado com o `tsx`): lê o arquivo da mensagem (o Git passa o caminho) ou, com `--range`, as mensagens de um intervalo de commits (`git log`), e sai com erro mostrando o motivo.
- **`.githooks/commit-msg`**: chama o script. Já fica ligado, porque o `core.hooksPath` aponta para `.githooks` desde o plano 012.
- **CI:** um passo no job `checks` confere as mensagens dos commits enviados (o intervalo do push, ou da pull request), com `fetch-depth: 0` no checkout.
- `--no-verify` continua proibido pelo `CLAUDE.md`.

### Alternativa descartada

`commitlint`: são duas dependências (CLI e configuração) com vários pacotes por baixo, para uma regra que cabe em uma função testada.

## 2. Hook `pre-push` (pergunta 2)

Roda antes de `git push`, nesta ordem, e para no primeiro erro:

1. **`npm test`** completo (unidade e integração). A integração precisa do banco de teste: se o Postgres não responder, o hook diz "Suba o banco: docker compose up -d" em vez do erro cru do Prisma.
2. **`npm audit --audit-level=moderate`**, o mesmo nível do CI.

Ficam de fora: os e2e (lentos; a diretriz é deixá-los para o CI) e o build do contêiner (já está no critério de pronto de cada feature).

Hoje o projeto não tem remoto, então o hook só vai rodar quando houver push. Ele já fica pronto para isso.

## Fora de escopo

- Deploy automático pelo CI (espera o GitHub e o VPS).
- Verificar o idioma da mensagem, tamanho do corpo ou a linha `Co-Authored-By`.
- Changelog ou versão gerados a partir dos commits.
- Reescrever commits antigos.

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
src/lib/commit-message.ts (+ teste)
scripts/check-commit-message.ts (novo)
.githooks/commit-msg, .githooks/pre-push (novos)
package.json (script check:commits)
.github/workflows/ci.yml (passo de verificação das mensagens)
CLAUDE.md (Workflow: tipos aceitos e os dois hooks)
```

## Testes (escritos antes do código, em TDD)

### Unidade (`src/lib/commit-message.test.ts`)

- Aceita: cada tipo, com e sem escopo, com `!`, com corpo e rodapé, com comentários do Git no fim; e as mensagens do próprio Git (merge, revert, fixup, squash, amend).
- Recusa, com o motivo certo: sem tipo, tipo desconhecido ou em maiúscula, escopo vazio ou inválido, sem espaço depois dos dois-pontos, descrição vazia, descrição em maiúscula, ponto final, primeira linha com mais de 72 caracteres, corpo colado na primeira linha, mensagem vazia.
- **Todo o histórico atual passa** (o teste lê `git log` do repositório): garante que as regras não recusam o que já foi aceito.

### Verificação manual

- Um commit com mensagem errada é recusado e mostra o motivo; com a mensagem certa, passa (registrado no plano).
- `npm run check:commits -- main~5..main` confere um intervalo.
- O `pre-push` roda de ponta a ponta com o banco no ar e mostra a mensagem amigável com o banco parado. Sem remoto, a verificação é chamar o hook direto (`sh .githooks/pre-push`).

## Critério de pronto

- `npm run lint`, `npm run typecheck` e `npm test` passando; sem e2e (não há mudança de tela).
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **Tipos aceitos?** Proposta: os seis do `CLAUDE.md` mais `ci`, `build`, `perf`, `style` e `revert`, os outros do padrão Conventional Commits.
2. **O que o pre-push roda?** Proposta: `npm test` completo e `npm audit`; sem e2e e sem o build do contêiner.
3. **Verificar também no CI?** Proposta: sim, as mensagens dos commits de cada push e pull request, para pegar quem fizer commit sem o hook ligado.

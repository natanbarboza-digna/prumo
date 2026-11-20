# 026 — Duplicar trilha

Status: **proposto**, aguardando aprovação
Branch: `feat/duplicate-track`

Segundo plano do grupo Listas (arquivar trilhas, duplicar trilha, busca única). Retoma o que ficou fora do plano 002.

## Objetivo

Usar uma trilha como modelo: um botão **"Duplicar"** cria uma trilha nova com as mesmas etapas, pronta para começar do zero. Serve para repetir um roteiro (por exemplo, "Estudar um framework novo") ou para refazer uma trilha antiga, inclusive uma já arquivada.

## Regras

- Botão **"Duplicar trilha"** na página da trilha, sem confirmação (não altera nem apaga nada). Ao clicar, a trilha nova é criada e a tela vai para ela.
- **O que é copiado:**

| Campo              | Na cópia                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| Título             | "Cópia de " + título original, cortado em 120 caracteres (o limite do campo) |
| Descrição          | Igual                                                                        |
| Objetivo vinculado | Igual (pergunta 1)                                                           |
| Etapas             | Todas, na mesma ordem, com título, link do recurso e anotações               |
| Status das etapas  | Todas "Não iniciada"                                                         |
| Prazos das etapas  | Vazios (pergunta 2)                                                          |
| Arquivamento       | A cópia nasce ativa, mesmo que a original esteja arquivada (pergunta 3)      |

- A trilha original não muda.
- Tudo numa transação: ou a trilha e todas as etapas são criadas, ou nada.

## Fora de escopo

- Escolher na hora o que copiar (sem etapas, com prazos, com status).
- Trilhas "modelo" separadas das trilhas comuns.
- Duplicar etapas avulsas, objetivos ou ciclos de PDI.
- Busca única (próximo plano).

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- **`src/modules/tracks/service.ts`:** `duplicateTrack(id)` devolve a trilha nova. Uma regra pura, `copyTitle(title)`, monta "Cópia de …" respeitando o limite.
- **`src/modules/tracks/actions.ts`:** `duplicateTrackAction(id)`, com `requireSession()`, as revalidações de sempre e o redirecionamento para a trilha nova. Trilha que sumiu em outra aba: atualiza a página, que mostra o "não encontrado".
- **`src/app/(app)/tracks/[id]/page.tsx`:** o botão (um `<form>` com `SubmitButton`, "Duplicando…" durante o envio), presente também na trilha arquivada.

## Arquivos afetados

```
src/modules/tracks/{service,actions}.ts (+ testes)
src/app/(app)/tracks/[id]/page.tsx
e2e/tracks.spec.ts
CLAUDE.md (regra)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `copyTitle`: "Inglês" vira "Cópia de Inglês"; um título de 120 caracteres é cortado para caber.

### Integração (service)

- A cópia tem título, descrição e objetivo da original, e as etapas na mesma ordem (posições 1, 2, 3…), com título, link e anotações, todas "Não iniciada" e sem prazo.
- A original continua igual (etapas, status e prazos).
- Duplicar uma trilha arquivada gera uma cópia ativa.
- Duplicar uma trilha sem etapas funciona.
- Trilha inexistente: `TrackNotFoundError`.

### E2E (`tracks.spec.ts`, dados pelas factories)

1. "Duplicar trilha" abre "Cópia de Inglês" com as etapas na mesma ordem, todas "Não iniciada"; a original continua na lista.
2. Na trilha arquivada, "Duplicar trilha" também aparece, e a cópia não tem o aviso de somente leitura.

Roda o `tracks.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e o e2e de trilhas passando.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- `CLAUDE.md` e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **A cópia mantém o objetivo vinculado?** Proposta: sim; dá para trocar ou tirar pela edição. Quem duplica para outro objetivo edita logo em seguida, e quem duplica para o mesmo não precisa fazer nada.
2. **E os prazos das etapas?** Proposta: vazios. As datas da original quase sempre já passaram; recalculá-las a partir de hoje é adivinhar.
3. **Duplicar uma trilha arquivada?** Proposta: pode, e a cópia nasce ativa. É o caso típico de reaproveitar um roteiro antigo.

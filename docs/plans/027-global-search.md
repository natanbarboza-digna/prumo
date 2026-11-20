# 027 — Busca única

Status: **implementado em 2026-11-20**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/global-search`

Último plano do grupo Listas (arquivar trilhas, duplicar trilha, busca única). Retoma a "busca por texto" que ficou fora dos planos 001 e 002.

## Objetivo

Responder "onde está aquilo?" num lugar só: uma página de busca que procura ao mesmo tempo em objetivos, trilhas e etapas, rotinas e no PDI, e leva direto ao item.

## Como fica

### Entrada (pergunta 1)

- Um botão com ícone de lupa no cabeçalho, ao lado do tema e da conta, com o nome acessível "Buscar". Ele leva a **`/search`**.
- A página `/search` tem o campo "Buscar" e o botão "Buscar". O termo vai na URL (`/search?q=inglês`): dá para voltar, recarregar e guardar o link. É um formulário comum (`GET`), que funciona sem JavaScript.
- Proposta descartada: um campo de busca fixo no cabeçalho. No celular, o cabeçalho já quebra em duas linhas (plano 009) e não cabe mais um campo.

### O que é buscado

| Grupo         | Onde procura                           | Resultado leva a          |
| ------------- | -------------------------------------- | ------------------------- |
| Objetivos     | título e descrição                     | página do objetivo        |
| Trilhas       | título e descrição                     | página da trilha          |
| Etapas        | título e anotações                     | página da trilha da etapa |
| Rotinas       | título e descrição                     | página da rotina          |
| Ciclos de PDI | título                                 | página do ciclo           |
| Ações de PDI  | título, descrição e resultado esperado | página da ação            |

- **Sem diferenciar maiúsculas nem acentos** (pergunta 2): "comunicacao" acha "Comunicação". Usa a extensão `unaccent` do Postgres.
- O termo precisa ter **pelo menos 2 caracteres** (com 1, a página pede mais). Espaços nas pontas são ignorados. O termo inteiro é procurado como trecho (`inglês avançado` acha "Inglês avançado", não "avançado em inglês").
- **Itens guardados também aparecem** (pergunta 3), com um selo: objetivo e trilha arquivados ("Arquivado"/"Arquivada"), rotina encerrada ("Encerrada"), ciclo e ação de ciclo encerrado ("Ciclo encerrado"). Quem busca quase sempre procura algo antigo.

### Resultados

- Agrupados na ordem da tabela, cada grupo com título e contagem ("Trilhas (2)"). Grupo sem resultado não aparece.
- Cada item mostra o título e uma linha de contexto: a trilha da etapa, o ciclo da ação, o status do objetivo.
- **Até 20 itens por grupo**, os mais recentes primeiro; se houver mais, "e mais 5 trilhas — refine a busca".
- Sem resultado: "Nada encontrado para “xyz”." Sem termo: só o campo, com uma dica do que é buscado.
- O título da página (aba do navegador) inclui o termo: "Busca: inglês · Prumo".

## Fora de escopo

- Destacar o trecho encontrado no texto.
- Busca enquanto digita (sugestões) e atalho de teclado para abrir a busca.
- Buscar em check-ins de PDI, áreas de PDI, registros de rotina e notas.
- Filtros na página de busca e paginação.
- Índices de texto (`pg_trgm`, busca textual completa): com poucas centenas de linhas, a busca simples responde em milissegundos.

## Mudanças no modelo de dados

- **Migration** com `CREATE EXTENSION IF NOT EXISTS unaccent;`. Não muda nenhuma tabela. A extensão vem na imagem oficial do Postgres 18, usada no Docker local, no contêiner de produção e no CI. O banco de teste recebe a migration pelo `migrate deploy` do `global-setup`.

## Organização do código

- **`src/modules/search/`** (domínio novo, só leitura, como o `dashboard`):
  - `schemas.ts`: `searchQuerySchema` (texto aparado, 2 a 100 caracteres; fora disso, sem busca).
  - `service.ts`: `search(term)` devolve os seis grupos (`{ items, total }`). As consultas usam `$queryRaw` com `unaccent(lower(coluna)) LIKE unaccent(lower($1))`, com o termo como parâmetro (nunca concatenado no SQL) e `%`, `_` e `\` escapados para valerem como texto. As seis consultas rodam juntas (`Promise.all`).
  - `labels.ts`: títulos dos grupos, contagens e "e mais…".
- **`src/app/(app)/search/page.tsx`** com `loading.tsx` e `error.tsx`: lê `q` dentro de `<Suspense>` (regra do Cache Components) e mostra os grupos.
- **`src/components/search/`**: o formulário e a lista de resultados.
- **Cabeçalho** (`src/app/(app)/layout.tsx`): o botão da lupa.

## Arquivos afetados

```
prisma/migrations/<data>_add_unaccent/
src/modules/search/{schemas,service,labels}.ts (+ testes)
src/app/(app)/search/{page,loading,error}.tsx
src/components/search/{search-form,search-results}.tsx
src/app/(app)/layout.tsx
e2e/search.spec.ts (novo), e2e/mobile.spec.ts (página nova em PAGES)
CLAUDE.md (estrutura de pastas, regra da busca)
```

## Testes (escritos antes do código, em TDD)

### Unidade

- `searchQuerySchema`: apara, recusa vazio, 1 caractere e mais de 100.
- Escape do termo: `50%` e `a_b` são procurados como texto.
- Textos: título com contagem, "e mais N" no singular e no plural.

### Integração (service, banco de teste)

- Acha em cada grupo, por cada campo da tabela, e leva o vínculo certo (etapa com a sua trilha, ação com o seu ciclo).
- Ignora maiúsculas e acentos nos dois sentidos ("comunicacao" acha "Comunicação"; "COMUNICAÇÃO" acha "comunicacao").
- Inclui objetivo e trilha arquivados, rotina encerrada e ciclo encerrado, marcados.
- Limita a 20 por grupo, mais recentes primeiro, com o total certo.
- `%` e `_` no termo não funcionam como curinga.

### E2E (`search.spec.ts`, dados pelas factories)

1. A lupa do cabeçalho abre a busca; buscar "ingles" mostra a trilha "Inglês", a etapa e o objetivo, e o clique leva à página certa.
2. Sem resultado mostra a mensagem; com 1 caractere, pede mais.
3. A página de busca passa no axe (com e sem resultados). O `mobile.spec.ts` ganha `/search` na lista de páginas.

Rodam o `search.spec.ts` e o `mobile.spec.ts`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e os e2e da área passando.
- Migration incluída.
- `npm run container:up` e `npm run container:check` passando (plano 025), o que também prova a extensão no contêiner `migrate`.
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Sem `error.tsx` próprio:** o `error.tsx` de `src/app/(app)/` já cobre a rota.
- **`await connection()` na página:** o "hoje" (para saber se a rotina está encerrada) é lido antes do banco; sem a chamada, o Next tentava pré-renderizar a página e acusava `new Date()` no log do servidor. Os outros lugares que leem o "hoje" fazem o mesmo.
- **Ids com `useId`** no formulário e nos títulos dos grupos (Server Components também podem usar `useId`), porque o Next guarda cópias escondidas das páginas visitadas.
- **Escape do `LIKE` com `!`** (`ESCAPE '!'`) em vez de `\`, para não depender de como a barra invertida passa pelo template do Prisma.
- **Linha de contexto:** objetivo mostra o status; trilha, o objetivo vinculado; etapa, a trilha; ciclo, o período; ação, o ciclo e a área; rotina, nada.
- **`mobile.spec.ts`:** a página entrou como `/search?q=prumo`, para a verificação de rolagem horizontal pegar o estado com resultados.
- **Verificações:**
  - `npm run lint`, `npm run typecheck` e `npm test` (511 testes);
  - e2e: `search.spec.ts` (3 testes) e `mobile.spec.ts` (5);
  - `npm run container:up` e `npm run container:check` passando. O `migrate` do contêiner achou 10 migrations e nenhuma pendente, porque a do `unaccent` já tinha sido aplicada no banco de desenvolvimento durante a implementação. A extensão está nesse banco (o app do contêiner usa o mesmo), mas o contêiner não a aplicou sozinho desta vez: a prova de que a migration roda num banco novo é o `global-setup` dos testes, que aplica todas as migrations no banco de teste.

## Decisões

1. Lupa no cabeçalho que leva a `/search`.
2. Sem diferenciar acentos, com a extensão `unaccent`.
3. Itens arquivados e encerrados entram, com selo.

## Perguntas (cada uma com uma proposta)

1. **Entrada da busca?** Proposta: lupa no cabeçalho que leva a `/search`, em vez de um campo fixo no cabeçalho.
2. **Ignorar acentos com a extensão `unaccent`?** Proposta: sim. Sem ela, "comunicacao" não acha "Comunicação", o que é o erro mais comum ao digitar rápido. É uma migration de uma linha, sem dependência nova.
3. **Itens arquivados e encerrados entram?** Proposta: sim, com selo.

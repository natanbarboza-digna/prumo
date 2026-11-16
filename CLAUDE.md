# Gestão Pessoal (nome provisório)

Aplicação web de uso pessoal para gerir objetivos, trilhas de desenvolvimento, rotina diária e ciclos de PDI (Plano de Desenvolvimento Individual) trazidos da empresa. Um único usuário, rodando localmente.

O dono do projeto vem de Python/Django e está aprendendo Next.js e TypeScript. Ao tomar uma decisão específica dessas tecnologias (Server vs Client Component, Server Action, tipagem não óbvia), explique o porquê em uma ou duas frases.

## Stack

- Next.js (App Router) + TypeScript em modo `strict`
- PostgreSQL em Docker Compose (só o banco no contêiner; a aplicação roda no host)
- Prisma como ORM, com migrations versionadas
- Tailwind CSS + shadcn/ui
- Zod para validação, com o mesmo schema no formulário e no servidor
- Server Actions para mutações; Route Handlers só se houver consumidor externo
- Vitest (unidade e integração) e Playwright (fluxos principais)
- ESLint + Prettier
- `next-themes` (tema claro/escuro) e `@axe-core/playwright` (verificação de acessibilidade nos e2e)

Dependências de suporte já aprovadas: `@prisma/adapter-pg`, `pg`, `@types/pg`, `dotenv`, `tsx`, `vite`, `vite-tsconfig-paths`, `eslint-config-prettier` e as que o `shadcn` instala (`clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, primitivas Radix).

Versões fixadas por incompatibilidade (revisar periodicamente): TypeScript 6.0 (o `typescript-eslint` ainda não aceita a 7) e Prisma 7.10 (a tag `latest` da CLI apontava para uma RC).

Use as versões estáveis atuais no momento do scaffold e consulte a documentação da versão instalada antes de usar uma API do framework: não confie na memória para Next.js, Prisma ou shadcn/ui, porque mudam com frequência.

Não adicione dependências fora desta lista sem perguntar antes.

## Comandos

Estes scripts devem existir no `package.json` desde o scaffold:

| Comando                  | O que faz                          |
| ------------------------ | ---------------------------------- |
| `docker compose up -d`   | Sobe o PostgreSQL                  |
| `npm run dev`            | Servidor de desenvolvimento        |
| `npm run lint`           | ESLint                             |
| `npm run typecheck`      | `tsc --noEmit`                     |
| `npm test`               | Vitest                             |
| `npm run test:e2e`       | Playwright                         |
| `npx prisma migrate dev` | Cria e aplica migration            |
| `npx prisma db seed`     | Dados iniciais (categorias padrão) |

## Estrutura de pastas

```
src/
  app/                  rotas do App Router; só composição de UI e chamada de actions
    goals/  tracks/  routines/  pdi/  settings/categories/
  components/           componentes da aplicação
  components/ui/        componentes do shadcn/ui
  modules/<dominio>/    um diretório por domínio: goals, tracks, routines, pdi, categories
    schemas.ts          schemas Zod
    service.ts          regras de negócio e acesso ao banco
    actions.ts          Server Actions (validam com Zod e chamam o service)
    *.test.ts           testes ao lado do código
  lib/                  db.ts (cliente Prisma), datas, utilitários
prisma/                 schema.prisma, migrations/, seed.ts
e2e/                    testes Playwright
docs/plans/             planos de feature (ver Workflow)
```

Regras de negócio ficam em `service.ts`, nunca em componentes ou em `actions.ts`. Isso é o que permite testá-las sem a UI.

## Modelo de domínio

Nomes de entidades e campos em inglês no código. Os campos abaixo são o ponto de partida; mudanças no modelo passam por plano aprovado.

**Objetivos**

- `Goal`: title, description, status (`NOT_STARTED`, `IN_PROGRESS`, `DONE`, `ARCHIVED`), targetDate

**Trilhas**

- `Track`: title, description, goalId (opcional)
- `TrackStep`: trackId, title, order, status, dueDate, resourceUrl, notes

**Rotina**

- `Routine`: title, description, weekdays (dias da semana em que se aplica), timeOfDay (opcional), startDate, endDate (opcional), goalId (opcional), pdiActionId (opcional)
- `RoutineLog`: routineId, date, status (`DONE`, `SKIPPED`), note. Único por (routineId, date)

**PDI**

- `PdiCycle`: title, startDate, endDate, status (`PLANNED`, `ACTIVE`, `CLOSED`), managerName, careerObjective, selfAssessment, managerFeedback, finalRating (opcional)
- `PdiArea` (área de desenvolvimento ou competência): cycleId, name, description, expectedOutcome
- `ActionCategory`: name, allowsRoutine (boolean), archived (boolean)
- `PdiAction`: areaId, categoryId, title, description, expectedResult, dueDate, status (`NOT_STARTED`, `IN_PROGRESS`, `DONE`, `CANCELLED`), evidence, managerComment, goalId (opcional)
- `PdiCheckIn`: cycleId, date, summary, nextSteps, managerNotes

Premissa a validar: os campos de `PdiCycle`, `PdiArea`, `PdiAction` e `PdiCheckIn` são um padrão genérico, não o formulário real da empresa. Antes de implementar o módulo PDI, pergunte ao dono do projeto se os campos conferem.

## Regras de negócio

- Categorias de ação são um cadastro gerenciado pelo usuário (criar, editar, arquivar). O seed cria: "Prática" (`allowsRoutine = true`), "Curso", "Leitura" e "Mentoria" (`allowsRoutine = false`).
- Nenhum comportamento depende do nome da categoria. O que libera a criação de rotina é `allowsRoutine`.
- Só é possível criar uma rotina a partir de uma ação de PDI se a categoria dela tiver `allowsRoutine = true`. A regra é validada no service, não só escondendo o botão.
- A rotina criada a partir de uma ação fica vinculada por `pdiActionId`. Os registros (`RoutineLog`) aparecem na ação como evidência, com a taxa de adesão no período.
- Ao concluir ou cancelar uma ação com rotina vinculada, o usuário escolhe entre encerrar a rotina (preenche `endDate`) ou mantê-la sem vínculo.
- Mudar a categoria de uma ação ou desligar `allowsRoutine` não apaga rotinas já existentes; só bloqueia novas.
- Categoria arquivada não pode ser atribuída a novas ações. Categoria em uso não pode ser excluída, só arquivada.
- Ciclo com status `CLOSED` é somente leitura.
- Etapas de trilha, ações de PDI e rotinas podem se vincular a um objetivo; o objetivo mostra o progresso agregado desses itens.
- Datas de rotina e de registro são datas sem hora, no fuso `America/Fortaleza`. Nunca derive "hoje" de UTC.

## Workflow

1. **Plano antes do código.** Para cada feature, escreva um plano em `docs/plans/NNN-slug.md` com escopo, fora de escopo, mudanças no modelo de dados, arquivos afetados e lista de testes. Pare e aguarde aprovação explícita antes de implementar.
2. **TDD.** Escreva o teste, veja-o falhar, implemente o mínimo para passar, refatore. Regras de negócio são testadas no service contra um banco de teste separado (`.env.test`); fluxos de ponta a ponta, no Playwright.
3. **Branches.** Uma branch por feature a partir da `main` (`feat/goals-crud`, `fix/routine-log-date`). Nunca commite direto na `main`. Não faça merge nem push sem ser pedido.
4. **Commits.** Conventional Commits em inglês (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`), pequenos e atômicos.
5. **Pronto significa:** `npm run lint`, `npm run typecheck` e `npm test` passando, migration incluída quando o schema mudou e plano atualizado se o escopo mudou durante a implementação.

Não implemente nada fora do plano aprovado. Se surgir uma melhoria ou um problema fora do escopo, anote em "Pendências" abaixo e siga.

## Convenções

- Interface em pt-BR; código, nomes de arquivos, rotas e commits em inglês.
- Server Components por padrão; `"use client"` só onde houver interatividade.
- Toda entrada de usuário é validada com Zod no servidor, mesmo que o formulário já valide.
- Sem `any` e sem `@ts-ignore`; se for inevitável, comente o motivo.
- Segredos só em `.env` (fora do git); mantenha `.env.example` atualizado.

### Front-end

- **Acessibilidade:** HTML semântico (`main`, `nav`, títulos em ordem, `button` para ação e `a` para navegação); todo campo com `label` e erro ligado por `aria-describedby`; navegação completa por teclado com foco visível; contraste WCAG AA. Regras `jsx-a11y` do ESLint ativas.
- **Estados de tela:** toda rota trata carregamento (`loading.tsx`/`Suspense`), erro (`error.tsx`) e não encontrado (`not-found.tsx`). Lista vazia mostra mensagem com a próxima ação.
- **Formulários:** mesmo schema Zod no cliente e no servidor; erros do servidor por campo via `useActionState`; botão desabilitado com indicação durante o envio; confirmação antes de ação destrutiva.
- **Desempenho:** Server Components por padrão, `"use client"` no menor componente possível; `next/font` e `next/image`; nada de buscar dados no cliente quando o servidor pode entregar pronto.
- **Responsivo e consistente:** mobile-first; cores, espaçamentos e raios só pelos tokens do tema (Tailwind/shadcn), sem valores arbitrários soltos. Tema claro/escuro via `next-themes`.
- **Testes:** no Playwright, localize por papel e nome acessível (`getByRole`); cada página principal passa na verificação do axe.

## Roteiro

0. Scaffold, ferramentas, banco no Docker, um teste de fumaça de cada tipo
1. Objetivos
2. Trilhas e etapas
3. Rotinas e registro diário (tela "Hoje")
4. Categorias de ação e ciclos de PDI
5. Criação de rotina a partir de ação de PDI
6. Painel inicial com visão consolidada

## Pendências

- **Autenticação.** Hoje não há login nem tabela de usuário, porque a aplicação roda só na máquina do dono. É obrigatória antes de qualquer deploy fora dela; vai exigir adicionar `userId` às entidades por migration.
- **Deploy.** Ainda não definido (roda só localmente).
- **Campos do PDI.** Validar com o formulário real da empresa (ver premissa no Modelo de domínio).
- **Importação de PDI por arquivo.** Fora de escopo por enquanto; o cadastro é manual.

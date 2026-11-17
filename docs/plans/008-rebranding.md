# 008 — Rebranding: nome e visual

Status: **aguardando aprovação** (o nome depende da pergunta 1)
Branch: `chore/rebranding`

## Objetivo

Dar ao projeto um nome definitivo no lugar de "Gestão Pessoal (nome provisório)" e refinar o visual numa direção **minimalista sóbria**: quase monocromático, tipografia em evidência e cor só onde ela carrega significado (atrasado, concluído). O nome muda na interface, na documentação, no pacote e no banco.

## Nome (pergunta 1)

Critérios: curto, em português, fácil de digitar como slug, e com sentido ligado a direção, constância ou progresso, sem prender o app a um módulo só.

| Nome      | Sentido                                                                                                                    | Slug (pacote e banco) |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Prumo** | O fio de prumo mantém a obra na vertical; "manter o prumo" é seguir firme no rumo. Combina com o visual sóbrio. (Proposta) | `prumo`               |
| **Rumo**  | Direção: objetivos e trilhas apontam para onde ir.                                                                         | `rumo`                |
| **Norte** | Referência fixa, como o objetivo de carreira do PDI.                                                                       | `norte`               |
| **Ritmo** | Cadência do dia a dia; puxa mais para rotinas.                                                                             | `ritmo`               |
| **Passo** | Avanço feito de pequenas etapas; puxa mais para trilhas.                                                                   | `passo`               |

O resto do plano usa **Prumo** como exemplo; com outro nome, só os textos mudam.

**Slogan** (aparece sob o título do painel e na descrição da página): "Objetivos, trilhas, rotina e PDI no mesmo prumo." Com outro nome, uma frase equivalente.

## Escopo

### Visual

- **Paleta neutra refinada** em `src/app/globals.css`: o cinza puro de hoje (croma 0) ganha um leve tom quente (croma ≈ 0,005, matiz ≈ 80), mais confortável para leitura longa. Mesmo contraste de hoje ou maior; tudo continua passando no axe (WCAG AA), nos temas claro e escuro.
- **Cor só nos estados**, com dois tokens novos no tema:
  - `--success`: verde sóbrio para "Concluído/Concluída" (objetivo, etapa, ação, trilha) e para as barras de progresso completas.
  - `--destructive`: já existe e continua para atrasos e exclusões, com o tom ajustado à nova paleta.
  - Nenhuma outra cor de destaque: botões primários continuam quase pretos (claro) e quase brancos (escuro).
- **Selos de status**: "Concluído" passa a usar uma variante `success` do `Badge` (fundo `success` em baixa opacidade, texto `success`). Os outros estados ficam em contorno ou neutros.
- **Tipografia em evidência**:
  - Continua a Geist (já carregada pelo `next/font`, sem dependência nova).
  - Títulos com escala mais marcada: `h1` maior e mais pesado, `h2` de seção com peso médio e espaçamento justo.
  - Números (percentuais, contagens, datas nos cards) com `tabular-nums`, para alinharem em listas.
  - Rótulos pequenos (tipo do prazo, "Área", "Prazo") em caixa alta e tamanho `xs` com espaçamento largo, como legenda.
- **Formas**: raio menor (`--radius` de 0,625rem para 0,5rem), bordas finas e sem sombras.
- **Cabeçalho**: o texto "Gestão Pessoal" vira a marca, com o ícone à esquerda do nome. Navegação e alternância de tema continuam iguais.
- **Ícone e favicon**: um monograma simples (a inicial do nome sobre um traço vertical, o "fio de prumo") em SVG, monocromático. Usa a convenção de arquivo do App Router (`src/app/icon.svg`), no lugar do `favicon.ico` padrão do Next. O mesmo desenho vira um componente `BrandMark` no cabeçalho, com `currentColor` para seguir o tema.

### Nome na interface

- `metadata` do layout: `title.default` e `title.template` (`"%s · Prumo"`) e a `description` com o slogan.
- Cabeçalho (link para `/`) e `h1` do painel.
- Nenhum texto de tela além desses cita o nome; o resto continua igual.

### Nome na documentação

- `CLAUDE.md`: título "Prumo" (sem "nome provisório") e a frase de abertura.
- Os planos 000 a 007 **não** são reescritos: são o registro histórico do que foi decidido na época. Este plano registra a troca.
- Não existe README hoje; criar um fica fora de escopo.

### Nome no pacote e no banco (pergunta 2)

- `package.json` e `package-lock.json`: `name` de `personal-management` para `prumo`.
- `docker-compose.yml`: `name: prumo` no topo. Hoje o nome do projeto vem da pasta (`natan-personal_management`), por isso o contêiner e o volume têm esse prefixo. Com `name`, viram `prumo-db-1` e `prumo_pgdata`.
- Banco e usuário: `personal_management` vira `prumo`, e o banco de teste `personal_management_test` vira `prumo_test`.
  - `.env.example`, `docker/postgres/init/01-create-test-database.sql` e `src/lib/db.int.test.ts` (que confere o nome do banco de teste).
  - `.env` e `.env.test` (locais, fora do git): só os nomes de usuário e banco mudam; a senha continua a mesma.
- **Como o banco de desenvolvimento muda:** um volume novo (`prumo_pgdata`) nasce vazio, e o script de inicialização cria o banco de teste. Depois: `npx prisma migrate deploy`, `npx prisma db seed` e `npm run db:seed:demo`.
  - Hoje o banco de desenvolvimento só tem a demonstração. Antes de trocar, confiro isso. Se houver qualquer dado além dela, faço `pg_dump` do banco antigo e restauro no novo, em vez de recriar.
  - O volume antigo (`natan-personal_management_pgdata`) **não** é apagado: fica para você remover quando quiser (`docker volume rm natan-personal_management_pgdata`).

## Fora de escopo

- Renomear a pasta do projeto no disco ou o repositório remoto (é com você; a memória do Claude Code fica ligada ao caminho atual da pasta).
- Trocar a família tipográfica ou adicionar fontes.
- Redesenhar o layout das telas (ordem dos blocos, navegação, componentes); só o tema, os selos, a tipografia e a marca mudam.
- Ilustrações, tela de boas-vindas nova ou modo de alto contraste.
- A revisão visual no celular das telas antigas continua nas Pendências, mas as capturas deste plano (abaixo) já cobrem o painel, a tela Hoje, um ciclo de PDI e uma trilha.

## Mudanças no modelo de dados

Nenhuma. O schema do Prisma não muda; só o nome do banco onde ele é aplicado.

## Arquivos afetados

```
src/app/globals.css                        (paleta, --success, raio)
src/app/layout.tsx                         (metadata, marca no cabeçalho)
src/app/page.tsx                           (h1 e slogan)
src/app/icon.svg                           (novo; substitui src/app/favicon.ico, removido)
src/components/brand-mark.tsx              (novo)
src/components/ui/badge.tsx                (variante success)
src/components/{goals,tracks,pdi}/*badge*  (Concluído usa success)
src/components/ui/progress.tsx             (barra completa em success, se couber no componente)
src/components/dashboard/*.tsx, demais telas  (tabular-nums e rótulos de legenda, onde houver números e rótulos)
CLAUDE.md
package.json, package-lock.json
docker-compose.yml, docker/postgres/init/01-create-test-database.sql
.env.example, src/lib/db.int.test.ts
e2e/home.spec.ts                           (h1 com o novo nome)
```

## Testes

- **E2E:** `home.spec.ts` passa a esperar o `h1` com o novo nome e confere o `<title>` da página ("Prumo"). As verificações do axe que já existem em todas as páginas principais conferem o contraste da nova paleta; rodo a suíte inteira nos temas claro e escuro (o teste de tema escuro já existe; acrescento uma verificação do axe com o tema escuro no painel).
- **Integração:** `db.int.test.ts` confere que os testes rodam no banco `prumo_test`.
- **Visual:** capturas do painel, da tela Hoje, de um ciclo de PDI e de uma trilha, em 375 px e 1280 px, nos dois temas, com os dados de demonstração, para você comparar antes e depois. Ficam no scratchpad, não no repositório.
- Não há regra de negócio nova, então não há testes de service novos.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Banco novo no ar com a demonstração, app conferido no navegador nos dois temas.
- `CLAUDE.md` e este plano atualizados.

## Perguntas

1. **Nome.** Proposta: **Prumo**. Ou escolha outro da tabela, ou sugira o seu.
2. **Banco de desenvolvimento.** Proposta: recriar no volume novo e rodar a demonstração de novo (hoje ele só tem a demonstração). Se você já cadastrou dados reais, eu migro com `pg_dump`.
3. **Cor de "concluído".** Proposta: um verde sóbrio só nos selos e barras completas. A alternativa mais radical é não ter cor nenhuma além do vermelho de atraso.

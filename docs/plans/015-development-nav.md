# 015 — Trilhas e PDI no grupo Desenvolvimento

Status: **implementado em 2026-11-19**, aprovado com as propostas das perguntas (ver "Decisões")
Branch: `feat/development-nav`

## Objetivo

Tirar o PDI do menu principal. Trilhas e PDI passam a formar um item só, **Desenvolvimento**, com duas abas no topo das listas: Trilhas e PDI. O menu cai de 5 para 4 itens (Hoje, Objetivos, Desenvolvimento, Rotinas), e cabe inteiro no celular, inclusive em 320 px.

## Escopo

### Menu principal

- O item **Desenvolvimento** substitui Trilhas e PDI, na posição de Trilhas: Hoje, Objetivos, Desenvolvimento, Rotinas.
- Ele leva a `/tracks` (pergunta 2) e fica marcado como página atual (`aria-current="page"`) em qualquer tela de trilhas ou de PDI: `/tracks`, `/tracks/...`, `/pdi`, `/pdi/...`. A lista de links do `MainNav` passa a aceitar mais de um prefixo por item.

### Abas Trilhas | PDI

- Um componente novo, `DevelopmentTabs`, aparece no topo de `/tracks` e de `/pdi`, acima do título.
- São **links** (`<nav aria-label="Desenvolvimento">` com `aria-current="page"` na aba atual), e não abas de painel (`role="tablist"`): cada aba é outra página, com URL própria, e o `CLAUDE.md` pede `a` para navegação. O visual segue os filtros que já existem (`GoalFilter`, `RoutineFilter`).
- Só nas duas listas (pergunta 3). As telas de detalhe e os formulários continuam com o link de voltar que já têm ("← Trilhas", "← PDI").

### O que não muda

- **URLs:** `/tracks` e `/pdi` continuam iguais (pergunta 1), então links salvos, o painel e os links entre telas (ação de PDI → objetivo, rotina → ação) continuam funcionando.
- **Títulos:** o `h1` das listas continua "Trilhas" e "PDI", e o título da aba do navegador também.
- O link "Gerenciar categorias", o botão "Importar planilha" e o painel ficam como estão.

## Fora de escopo

- Mudar URLs para algo como `/development/tracks` (pergunta 1).
- Lembrar a última aba visitada.
- Reorganizar os outros itens do menu ou criar submenus.

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
src/components/main-nav.tsx                     (item Desenvolvimento, vários prefixos por item)
src/components/development-tabs.tsx             (novo)
src/app/(app)/tracks/page.tsx, src/app/(app)/pdi/page.tsx   (abas no topo)
e2e/mobile.spec.ts                              (4 links no menu)
e2e/navigation.spec.ts                          (novo)
CLAUDE.md                                       (onde fica o PDI; DevelopmentTabs na lista de reaproveitamento)
```

## Testes

### E2E (`e2e/navigation.spec.ts`, novo)

1. O menu principal tem exatamente Hoje, Objetivos, Desenvolvimento e Rotinas, e não tem mais "Trilhas" nem "PDI".
2. "Desenvolvimento" leva à lista de trilhas, com a aba Trilhas marcada; a aba PDI leva à lista de ciclos, com a aba PDI marcada e "Desenvolvimento" ainda marcado no menu.
3. Numa tela de detalhe (um ciclo de PDI e uma trilha), "Desenvolvimento" continua marcado no menu.
4. As listas com as abas passam no axe.

### Ajustes

- `e2e/mobile.spec.ts`: os 4 links novos; em 320 px, o menu inteiro cabe sem rolar a faixa (o teste do último link passa a usar "Rotinas").
- Os testes que abrem `/pdi` e `/tracks` pela URL continuam iguais.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Capturas do menu e das abas em 320, 375 e 1280 px conferidas.
- `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **Em 320 px o menu não cabe inteiro**, ao contrário do que o objetivo dizia: "Desenvolvimento" é longo, e os 4 itens somam mais que a faixa (medido: 344 px de links para 343 px de faixa em 375). Com o espaçamento interno dos itens menor no celular (`px-2`, voltando a `px-3` a partir de `sm`), eles cabem inteiros em 375 px. Em 320 px a faixa do menu continua rolando para o lado, como antes deste plano; a página não rola. O teste de 320 px voltou a conferir que o último item ("Rotinas") pode ser alcançado e clicado.
- **`DevelopmentTabs` é Server Component:** cada lista diz qual aba é a atual (`current="/tracks"` ou `"/pdi"`), sem precisar ler a URL no navegador.
- **Os testes novos não foram vistos falhando antes da implementação:** a primeira rodada esbarrou num `next dev` já aberto na pasta (o Next só permite um por projeto); depois de encerrá-lo, a implementação já estava pronta.

## Decisões

1. URLs mantidas: `/tracks` e `/pdi`.
2. "Desenvolvimento" leva à lista de trilhas.
3. As abas aparecem só nas duas listas.

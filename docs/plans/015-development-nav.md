# 015 — Trilhas e PDI no grupo Desenvolvimento

Status: **aguardando aprovação**
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

## Perguntas

1. **URLs.** Proposta: manter `/tracks` e `/pdi`. A alternativa é mudar para `/development/tracks` e `/development/pdi`, com redirecionamento das antigas.
2. **Para onde "Desenvolvimento" leva.** Proposta: para a lista de trilhas, que tende a ser mais usada no dia a dia. A alternativa é levar ao PDI.
3. **Onde as abas aparecem.** Proposta: só nas listas de trilhas e de ciclos. A alternativa é mostrá-las também nas telas de detalhe e nos formulários.

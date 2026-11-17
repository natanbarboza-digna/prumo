# 009 — Revisão no celular

Status: **implementado em 2026-11-16**, aprovado no mesmo dia com a proposta da pergunta (ver "Decisões")
Branch: `fix/mobile-layout`

## Objetivo

Fechar a pendência "Revisão visual no celular": conferir todas as telas em largura de celular e corrigir o que estiver quebrado.

## O que a revisão encontrou

Capturei 20 telas em 375 px com os dados de demonstração: painel, Hoje, lista e detalhe de objetivos, trilhas, rotinas e ciclos, página da ação, categorias e os formulários de objetivo, etapa, rotina, ciclo, ação e check-in. Também medi, por script, a rolagem horizontal da página e a altura do cabeçalho.

- **Cabeçalho (defeito).** A faixa do cabeçalho tem altura fixa (`h-14`, 56 px), mas em 375 px a navegação quebra em duas ou três linhas e ocupa até 73 px. As linhas de cima ficam cortadas ("Hoje" e "Objetivos" aparecem pela metade), e o destaque do item ativo muda de lugar conforme a página.
- **Rolagem horizontal:** nenhuma página rola para o lado em 375 px.
- **Conteúdo das telas:** listas, cards, selos, botões e formulários se ajustam bem. Nas etapas de trilha e nas áreas do PDI, as linhas de botões ficam justas mas cabem, e quebram de linha quando precisam.
- **Campos de data e hora** apareceram como "mm/dd/yyyy" e "07:00 AM". Isso vem do idioma do navegador de teste (inglês), não do app: num navegador em português eles aparecem como "dd/mm/aaaa" e "07:00". Nada a corrigir.
- O botão redondo "N" no canto das capturas é o indicador do Next em desenvolvimento; não aparece no app de produção.

## Escopo

### Cabeçalho em duas linhas no celular

- **Até a largura `md` (768 px):**
  - Primeira linha: a marca à esquerda e o botão de tema à direita.
  - Segunda linha: a navegação, ocupando a largura toda, **numa linha só**. Se não couber (em telas de 320 px), ela rola para o lado dentro da própria faixa, sem rolar a página.
- **A partir de `md`:** fica como hoje, tudo numa linha (marca, navegação, botão de tema).
- A altura fixa `h-14` sai: o cabeçalho passa a ter a altura do conteúdo, com um mínimo de 56 px.
- **Sem menu sanfona ("hambúrguer"):** os 5 links continuam sempre visíveis, sem JavaScript novo e sem diálogo para abrir e fechar. Com só 5 itens curtos, isso é mais rápido de usar e mais simples de manter acessível.
- A ordem do HTML continua a mesma (marca, navegação, tema), para a ordem do Tab ser igual em todas as larguras; só o CSS muda a posição visual da navegação.

### Conferência em 320 px

- Repito a medição de rolagem horizontal em 320 px, a largura dos celulares menores, e corrijo o que aparecer, se aparecer.

## Fora de escopo

- Navegação inferior fixa (estilo app), menu sanfona ou gestos.
- Mudar o layout interno das telas (as linhas de botões que ficam justas continuam como estão, porque cabem).
- Formato dos campos de data e hora (controlado pelo navegador, ver acima).

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
src/app/layout.tsx           (estrutura do cabeçalho)
src/components/main-nav.tsx  (navegação numa linha, com rolagem horizontal própria)
e2e/mobile.spec.ts           (novo)
CLAUDE.md                    (remove a pendência "Revisão visual no celular")
```

## Testes

### E2E (`e2e/mobile.spec.ts`, novo, com viewport de celular)

1. Em 375 px, o cabeçalho mostra os 5 links da navegação inteiros e visíveis, todos na mesma linha, abaixo da marca, e nenhum fica cortado no topo.
2. Em 375 px e em 320 px, nenhuma das páginas principais (painel, Hoje, objetivos, trilhas, rotinas, PDI, categorias) rola para o lado: a largura do documento é igual à da tela.
3. Em 320 px, a navegação continua utilizável: o último link ("PDI") pode ser alcançado e clicado.
4. Em 375 px, o painel com dados passa no axe.

Os testes em largura de desktop que já existem garantem que o cabeçalho continua numa linha só a partir de `md`.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando.
- Capturas do cabeçalho em 320, 375 e 1280 px, nos dois temas, conferidas.
- Pendência removida do `CLAUDE.md` e este plano atualizado.

## Mudanças durante a implementação

- **Links da navegação viraram `block`.** Como elementos inline, o espaçamento vertical deles saía da caixa da navegação e o `overflow-x-auto` cortava essa parte (o teste de visibilidade pegou: o link "Hoje" aparecia 85% visível).
- **Respiro para o anel de foco:** a faixa rolável ganhou `pt-1 pb-2` e a lista `px-1`, para o anel de foco do teclado não ser cortado nas bordas. A partir de `md`, a navegação volta a `overflow-visible`, sem esse respiro.
- **Ordem do Tab:** no celular, a navegação aparece depois do botão de tema, mas continua antes dele no HTML; a ordem do teclado segue a leitura da página (marca, navegação, tema).
- **320 px:** nenhuma página rolou para o lado; nada além do cabeçalho precisou de ajuste.

## Decisões

1. Navegação em duas linhas no celular, sempre visível, numa faixa que rola para o lado quando não cabe. Sem menu sanfona.

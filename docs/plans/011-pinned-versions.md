# 011 — Versões fixadas

Status: **implementado em 2026-11-17**, aprovado com as três propostas das perguntas (ver "Decisões")
Branch: `chore/pinned-versions`

## Objetivo

Resolver a pendência "Versões fixadas": conferir se TypeScript, ESLint e Prisma já podem subir de versão e, como a resposta muda com o tempo, transformar a revisão manual num comando que responde sozinho.

## O que a verificação encontrou (2026-11-16)

| Pacote     | Instalado | Mais nova                                | Pode subir? | Quem segura                                                                                                                                                                         |
| ---------- | --------- | ---------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript | 6.0.3     | 7.0.2                                    | **Não**     | `typescript-eslint` 8.73.0 (a mais nova) aceita `>=4.8.4 <6.1.0`: nem a 6.1 ainda.                                                                                                  |
| ESLint     | 9.39.5    | 10.15.0                                  | **Não**     | `eslint-plugin-react` 7.37.5 (`^9.7`), `eslint-plugin-jsx-a11y` 6.10.2 (`^9`) e `eslint-plugin-import` 2.32.0 (`^9`), todos na versão mais nova, puxados pelo `eslint-config-next`. |
| Prisma     | 7.10.1    | 7.10.1 estável; `latest` = `8.0.0-rc.34` | **Não**     | A tag `latest` aponta para uma RC do Prisma 8. A 7.10.1 já é a estável mais nova (`@prisma/client` e `@prisma/adapter-pg` também).                                                  |

Os três motivos do `CLAUDE.md` continuam valendo; só o do Prisma muda de texto (antes a RC era da 7, agora é da 8).

**Achado fora da lista:** o Node instalado é o **26.10.0**, mas o `@types/node` está na **24.19.2**. Os tipos descrevem a API do Node 24, então uma função nova do 26 não apareceria no editor, e uma removida não daria erro de tipo. O Next 16.4.6 exige Node `>=20.9.0`, então o 26 é suportado.

Os outros pacotes estão na versão mais nova dentro das faixas do `package.json` (`npm outdated` só lista os quatro acima).

## Escopo

### 1. Comando de verificação

- **`npm run check:versions`** roda `scripts/check-pinned-versions.mjs` (Node puro, sem dependência nova). Para cada versão fixada, consulta o registro do npm (`npm view`) e responde se já dá para subir:
  - **TypeScript:** a versão mais nova do TypeScript cabe no `peerDependencies.typescript` do `typescript-eslint` mais novo?
  - **ESLint:** a versão mais nova do ESLint cabe no `peerDependencies.eslint` de `eslint-plugin-react`, `eslint-plugin-jsx-a11y` e `eslint-plugin-import` (os mais novos)?
  - **Prisma:** a tag `latest` é uma versão estável (sem `-rc`, `-dev` etc.) e maior que a instalada?
- **Saída:** uma linha por pacote, por exemplo `TypeScript 6.0.3 → 7.0.2: ainda não (typescript-eslint 8.73.0 aceita >=4.8.4 <6.1.0)`. O código de saída é 0 em qualquer caso: o comando informa, não falha.
- **Faixas de versão:** a comparação "versão cabe na faixa" usa o pacote `semver`, que já está instalado como dependência do próprio npm e do ESLint, mas **não** está no `package.json`. Opções na pergunta 2.
- A lógica de decisão fica numa função pura (`canUpgrade`), testada com Vitest sem rede; só a busca no registro usa `npm view`.

### 2. `@types/node` alinhado ao Node instalado

- `@types/node` de `24.19.2` para `26.x` (a mais nova da 26).
- `engines.node: ">=26"` no `package.json` e um arquivo `.nvmrc` com `26`, para o projeto dizer qual Node espera (o npm avisa se rodar em outro).

### 3. Documentação

- `CLAUDE.md`:
  - **Stack:** o motivo do Prisma passa a ser "a tag `latest` aponta para a RC do Prisma 8".
  - **Comandos:** nova linha `npm run check:versions`.
  - **Pendências:** o item "Versões fixadas" sai. Em "Stack", a frase das versões fixadas passa a dizer "rode `npm run check:versions` para saber se já dá para subir", com o lembrete do `SerialClient` ao atualizar o Prisma.

## Fora de escopo

- Subir TypeScript, ESLint ou Prisma (nenhum pode, ver tabela).
- Trocar os plugins do `eslint-config-next` para chegar ao ESLint 10 antes do Next.
- O `npm audit` (pendência separada).
- Rodar o comando sozinho (CI ou agendamento): fica para a pendência de CI.

## Mudanças no modelo de dados

Nenhuma.

## Arquivos afetados

```
scripts/check-pinned-versions.mjs       (novo: busca no registro e imprime)
src/lib/pinned-versions.ts              (novo: canUpgrade, função pura)
src/lib/pinned-versions.test.ts         (novo)
package.json, package-lock.json         (script, @types/node, engines e, se aprovado, semver)
.nvmrc                                  (novo)
CLAUDE.md
```

A função pura fica em `src/lib/` porque o Vitest só procura testes em `src/`; o script em `scripts/` só faz a rede e a impressão. O script roda com `tsx` (já aprovado) para poder importar o arquivo `.ts`.

## Testes

### Unidade (`src/lib/pinned-versions.test.ts`)

- **TypeScript / ESLint (faixa de peer):** versão nova dentro da faixa → pode; fora → não pode, com o motivo; faixa com `||` (como `^8.57.0 || ^9.0.0 || ^10.0.0`); mais de um pacote segurando (ESLint) → não pode se qualquer um recusar, citando qual.
- **Prisma (tag latest):** `latest` estável e maior → pode; `latest` RC (`8.0.0-rc.34`) → não pode; `latest` igual à instalada → já está na mais nova.

### Conferência

- `npm run check:versions` rodado de verdade, com a saída colada neste plano.
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e` passando com o `@types/node` 26.

## Critério de pronto

- Tudo acima passando, `CLAUDE.md` e este plano atualizados.

## Mudanças durante a implementação

- **O script ficou em TypeScript** (`scripts/check-pinned-versions.ts`, rodado com `tsx`), em vez de `.mjs`, para importar a função pura de `src/lib/pinned-versions.ts` sem duplicá-la.
- **A função pura virou duas:** `peerVerdict` (TypeScript e ESLint, pela faixa de peer de quem segura) e `stableTagVerdict` (Prisma, pela tag `latest`). O plano falava de uma `canUpgrade` só.
- **O lembrete do `SerialClient`** também aparece na saída do comando quando o Prisma puder subir.
- **Versões instaladas:** `semver` 7.8.6, `@types/semver` 7.8.0 e `@types/node` 26.6.6, todas fixadas exatas (`--save-exact`).

### Saída real do comando (2026-11-17)

```
TypeScript 6.0.3 → 7.0.2: ainda não (typescript-eslint 8.73.0 aceita >=4.8.4 <6.1.0)
ESLint 9.39.5 → 10.15.0: ainda não (eslint-plugin-react 7.37.5 aceita ^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7; eslint-plugin-jsx-a11y 6.10.2 aceita ^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9; eslint-plugin-import 2.32.0 aceita ^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9)
Prisma 7.10.1 → 8.0.0-rc.34: ainda não (a tag latest aponta para 8.0.0-rc.34, que não é estável)
```

## Decisões

1. Criar o `npm run check:versions`.
2. Adicionar `semver` e `@types/semver` como dependências de desenvolvimento.
3. `@types/node` 26, `engines.node >=26` e `.nvmrc`.

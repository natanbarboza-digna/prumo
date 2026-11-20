# 023 — Aviso do `npm audit` no `effect` (Prisma)

Status: **implementado em 2026-11-20**, aprovado sem e2e (ver "Decisão")
Branch: `chore/effect-audit`

Pendência registrada no `CLAUDE.md` durante o plano 022.

## O problema

- `npm audit` mostra 3 avisos altos que são um só: **ReDoS no `Schema.TemplateLiteral` do `effect`** ([GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw)), afetando `effect <= 3.22.0`.
- Caminho: `prisma@7.10.1` → `@prisma/config@7.10.1` → `effect@3.20.0`, **versão fixa** (sem `^`), então um `npm update` não resolve.
- O `npm audit fix --force` propõe instalar o `prisma@6.12.0`, um rebaixamento de versão principal. Não serve.
- Não há Prisma 7 mais novo: a 7.10.1 é a última da linha 7, e a `latest` aponta para a RC do Prisma 8 (por isso a versão é fixada, plano 011).

## Risco real

Baixo, mas a regra do projeto é `npm audit` em 0 (plano 012), e o CI vai falhar quando existir. O `effect` só roda na **CLI do Prisma** (`@prisma/config` lê o `prisma.config.ts`), não na aplicação: o cliente que a aplicação usa (`@prisma/client` + `@prisma/adapter-pg`) não depende dele. No deploy, a CLI roda no contêiner de migração (`prisma migrate deploy`), lendo só o nosso arquivo de configuração.

## Proposta

Forçar o `effect` corrigido pelo `overrides` do `package.json`, como já fazemos com o `minimatch` (plano 012):

```json
"overrides": {
  "@ts-morph/common": { "minimatch": "^11.0.1" },
  "@prisma/config": { "effect": "3.22.5" }
}
```

- **3.22.5** é a última da linha 3 (a correção entrou na 3.22.1). Da 3.20 para a 3.22 é uma versão menor, que no semver não quebra a API.
- O `overrides` vale **só dentro do `@prisma/config`**, sem afetar outro pacote que venha a usar o `effect`.
- **Quando remover:** quando um Prisma 7.10.x ou o Prisma 8 (ao subirmos) trouxer o `effect` 3.22.1 ou mais novo. O `npm run check:versions` já avisa quando o Prisma pode subir; o `CLAUDE.md` registra a condição, como faz com o `minimatch`.

### Alternativas descartadas

- **`npm audit fix --force`:** rebaixa o Prisma para a 6.
- **Subir para o Prisma 8:** ainda é RC; a regra do plano 011 é esperar a versão estável.
- **Ignorar o aviso** (por exemplo, `--audit-level=critical` no CI): esconderia também avisos futuros de verdade.

## Verificação (não há regra de negócio nova, então não há teste novo)

A troca afeta só a CLI do Prisma. Confiro cada comando que a usa:

1. `npm install` sem erro e `npm ls effect` mostrando 3.22.5 sob o `@prisma/config`.
2. `npm audit` com **0 avisos**.
3. `npx prisma validate`, `npx prisma generate` e `npx prisma migrate status` (lê o `prisma.config.ts` e conversa com o banco).
4. `npx prisma migrate deploy` contra o banco de teste (os testes de integração já fazem isso no `global-setup`) e `npx prisma db seed`.
5. `npm run lint`, `npm run typecheck` e `npm test`.
6. **E2E:** nenhum spec exercita a CLI do Prisma além do que o `npm test` já faz, então não rodo nenhum. Se você preferir, rodo um spec rápido (`auth.spec.ts`) só como fumaça.

## Arquivos afetados

```
package.json, package-lock.json (overrides)
CLAUDE.md (seção de overrides; sai a pendência)
```

## Critério de pronto

- `npm audit` em 0, os comandos da CLI acima funcionando e lint, typecheck e `npm test` passando.
- `CLAUDE.md` atualizado, sem a pendência.

## Resultado

- `npm ls effect`: `effect@3.22.5 overridden` sob o `@prisma/config`; `npm audit`: 0 avisos.
- `prisma validate`, `generate`, `migrate status` (banco de desenvolvimento) e `db seed` sem erro; `migrate deploy` no banco de teste, pelo `global-setup` do `npm test`.
- `npm run lint`, `npm run typecheck` e `npm test` (484 testes) passando.
- Sem mudanças em relação ao plano.

## Decisão

1. Sem e2e: a mudança não chega à aplicação.

## Pergunta (com proposta)

1. **Rodar algum e2e?** Proposta: não, porque a mudança não chega à aplicação; a CLI é coberta pelos passos 3 e 4.

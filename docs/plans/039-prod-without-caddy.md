# 039 — Produção sem Caddy, pelo IP do servidor

Status: **proposto**, aguardando aprovação
Branch: `feat/prod-without-caddy`

Pedido do dono do projeto: colocar o Prumo em produção num VPS **antes de ter um domínio**, com o app buildado e **sem o Caddy**. Perguntado sobre o acesso, escolheu **pelo IP do servidor, em HTTP aberto**, sabendo que senha e sessão passam sem criptografia.

## O problema do cookie

Hoje o cookie da sessão é `Secure` em produção (plano 014). O navegador só guarda um cookie `Secure` em HTTPS ou em `localhost`: em `http://203.0.113.10` o login "funciona" no servidor, mas o navegador descarta o cookie e volta para a tela de login. Por isso, sem Caddy, é preciso desligar o `Secure` de forma **explícita**.

## Riscos (registrados para a decisão)

- Senha, cookie de sessão e todos os dados trafegam **sem criptografia**: qualquer rede no caminho (Wi-Fi público, provedor) pode ler ou roubar a sessão.
- Mitigações que já existem: bloqueio de 15 minutos após 5 senhas erradas (plano 014), sessão só como hash no banco, banco sem porta exposta.
- Recomendação registrada: usar assim só até ter o domínio e, se possível, evitar redes públicas. Trocar para HTTPS depois **não perde dados** (ver "Depois, com domínio").

## Como fica

### Dois arquivos do Compose (pergunta 4)

- **`docker-compose.prod.yml`** (base): banco, `migrate` e app, **sem o Caddy**. O app publica a porta `${APP_PORT:-80}` do servidor para a 3000 do contêiner (pergunta 1), com o mesmo healthcheck do contêiner local (plano 025).
- **`docker-compose.caddy.yml`** (novo): acrescenta o Caddy e **tira a porta pública do app** (`ports: !reset []`), para só o Caddy falar com ele. É o que o deploy de hoje faz.
- Comandos:
  - sem domínio: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`;
  - com domínio: o mesmo com `-f docker-compose.caddy.yml` a mais.
- Os dois usam o mesmo projeto (`prumo-prod`) e o mesmo volume do banco: passar de um para o outro mantém os dados.

### Cookie (pergunta 2)

- Nova variável **`SESSION_COOKIE_SECURE`**: em produção o cookie continua `Secure`, a não ser que ela seja exatamente `false`. Fora de produção (dev, testes) nada muda.
- `.env.production.example` traz a variável comentada, com o aviso do risco; o `docker-compose.prod.yml` repassa ao app.
- A regra fica numa função pura (`sessionCookieSecure`) com teste de unidade.

### Cabeçalhos de segurança (pergunta 3)

O Caddy acrescenta `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e `Referrer-Policy`. Sem ele, o próprio Next passa a enviar esses três em todas as respostas (`headers()` no `next.config.ts`), com e sem Caddy. O HSTS continua só no Caddy, porque só faz sentido com HTTPS.

### Guia de deploy

- `docs/deploy.md` ganha o caminho **"Sem domínio (HTTP pelo IP)"**: o `.env.production` sem `DOMAIN` e `ACME_EMAIL`, com `SESSION_COOKIE_SECURE=false`; firewall só com SSH e porta 80; o comando sem o arquivo do Caddy; endereço `http://IP-DO-SERVIDOR`.
- E o **"Depois, com domínio"**: apontar o DNS, preencher `DOMAIN` e `ACME_EMAIL`, apagar `SESSION_COOKIE_SECURE`, liberar a 443 e subir com o arquivo do Caddy. Os passos de hoje passam a usar os dois arquivos.
- O `README` aponta os dois caminhos.

## Fora de escopo

- HTTPS sem domínio (certificado autoassinado ou nomes como sslip.io) e túneis (SSH, Tailscale, Cloudflare): oferecidos e não escolhidos.
- Restringir o acesso por IP ou VPN no servidor.
- Mudar a imagem (`Dockerfile`) ou o contêiner local (`docker-compose.yml`, plano 025).
- Deploy automático (continua nas Pendências de fora do `CLAUDE.md`).

## Mudanças no modelo de dados

Nenhuma.

## Organização do código

- `src/modules/auth/cookie.ts` (puro): `sessionCookieSecure(env)`; `session.ts` passa a usá-lo.
- `next.config.ts`: `headers()` com os três cabeçalhos.
- `docker-compose.prod.yml` sem o Caddy, com porta, healthcheck e `SESSION_COOKIE_SECURE`; `docker-compose.caddy.yml` novo.
- `.env.production.example`, `docs/deploy.md`, `README.md` e `CLAUDE.md` (Stack: produção com ou sem Caddy; a variável nova).

## Arquivos afetados

```
src/modules/auth/cookie.ts, src/modules/auth/cookie.test.ts, src/modules/auth/session.ts
next.config.ts
docker-compose.prod.yml, docker-compose.caddy.yml, .env.production.example
docs/deploy.md, README.md, CLAUDE.md
```

## Testes (escritos antes do código, em TDD)

### Unidade (`cookie.test.ts`)

- Produção sem a variável: `Secure`. Produção com `SESSION_COOKIE_SECURE=false`: sem `Secure`. Produção com qualquer outro valor (`0`, `no`, `FALSE`, vazio): `Secure`. Desenvolvimento e teste: sem `Secure`, como hoje.

### E2E

- Os cabeçalhos: um teste no `e2e/auth.spec.ts` confere `nosniff`, `X-Frame-Options` e `Referrer-Policy` na resposta da tela de login.

### Manual (registrado no plano)

- `docker compose config` dos dois jeitos: sem Caddy (app com a porta publicada, sem serviço `caddy`) e com Caddy (serviço `caddy`, app sem porta).
- Subir a produção sem Caddy no computador, numa porta livre (`APP_PORT=3300`) e com um `.env` de teste: `/login` responde 200 com os cabeçalhos, e o cookie de login sai sem `Secure` com a variável e com `Secure` sem ela.
- O login pelo IP do VPS de verdade fica com o dono do projeto, depois do deploy.

## Critério de pronto

- `npm run lint`, `npm run typecheck`, `npm test` e o `auth.spec.ts` passando.
- `npm run container:up` e `npm run container:check` passando (plano 025).
- Verificações manuais acima registradas; `CLAUDE.md`, `docs/deploy.md`, `README.md` e este plano atualizados.

## Perguntas (cada uma com uma proposta)

1. **Porta 80 no servidor** (endereço `http://IP`, sem número)? Proposta: sim, com `APP_PORT` para trocar.
2. **Cookie sem `Secure` só com `SESSION_COOKIE_SECURE=false` explícito**, mantendo o padrão seguro? Proposta: sim.
3. **Cabeçalhos de segurança enviados pelo próprio Next**, com e sem Caddy? Proposta: sim (sem o HSTS, que fica no Caddy).
4. **Base sem Caddy e o Caddy num arquivo à parte**, para trocar depois sem perder dados? Proposta: sim.

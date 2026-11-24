# Deploy do Prumo num VPS

Guia para colocar o Prumo no ar num servidor seu, com Docker. Tudo roda em contêineres: o Postgres e o app e, quando houver domínio, o Caddy, que recebe as conexões da internet e cuida do certificado HTTPS (planos 014 e 039).

A mesma imagem roda no computador de desenvolvimento: `npm run container:up` e `npm run container:check` (plano 025). Se ela sobe ali, sobe no servidor.

## Dois jeitos

| Jeito           | Endereço                       | Arquivos do Compose                                    |
| --------------- | ------------------------------ | ------------------------------------------------------ |
| **Sem domínio** | `http://IP-DO-SERVIDOR`        | `docker-compose.prod.yml`                              |
| **Com domínio** | `https://prumo.seudominio.com` | `docker-compose.prod.yml` e `docker-compose.caddy.yml` |

**Sem domínio, nada é criptografado:** a senha, a sessão e os dados passam abertos pela rede, e quem estiver no caminho (um Wi-Fi público, por exemplo) pode lê-los ou roubar a sessão. Use assim só até ter o domínio e evite redes públicas. Passar para o jeito com domínio depois mantém todos os dados (veja "Depois, com domínio").

Para não repetir os arquivos em todo comando, crie um atalho no servidor (no `~/.bashrc`, para valer sempre). Os comandos deste guia usam `prumo`:

```bash
# Sem domínio:
alias prumo='docker compose -f docker-compose.prod.yml --env-file .env.production'
# Com domínio:
alias prumo='docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml --env-file .env.production'
```

## O que você precisa

- Um **VPS** com Linux (Ubuntu 24.04 ou Debian 12, por exemplo), 1 GB de RAM ou mais e 10 GB de disco. Qualquer provedor serve (Hetzner, DigitalOcean, Oracle Cloud etc.).
- O projeto num **repositório Git** que o servidor consiga clonar (por exemplo, um repositório privado no GitHub com uma _deploy key_).
- Com domínio: um **domínio** (ou subdomínio), como `prumo.seudominio.com`.

## 1. Apontar o domínio (só com domínio)

No painel de DNS do domínio, crie um registro **A** (e **AAAA**, se o VPS tiver IPv6) com o nome escolhido apontando para o IP do servidor. Espere a propagação (de minutos a algumas horas): `ping prumo.seudominio.com` deve responder com o IP do VPS.

## 2. Preparar o servidor

Entre no servidor por SSH e instale o Docker (com o plugin Compose) seguindo a documentação oficial (`docs.docker.com/engine/install`). Depois:

```bash
sudo usermod -aG docker "$USER"   # para usar docker sem sudo (saia e entre de novo no SSH)
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443                # só com domínio
sudo ufw enable
```

Ficam abertas só a 22 (SSH), a 80 e, com domínio, a 443. O banco nunca tem porta exposta. Sem domínio, o app responde na porta 80; com domínio, só o Caddy fala com o app, pela rede interna do Docker.

## 3. Baixar o projeto e configurar

```bash
sudo mkdir -p /opt/prumo && sudo chown "$USER" /opt/prumo
git clone <url-do-repositório> /opt/prumo
cd /opt/prumo
cp .env.production.example .env.production
nano .env.production
```

Preencha:

- `POSTGRES_PASSWORD`: uma senha longa e aleatória, gerada com `openssl rand -base64 32`;
- **sem domínio:** descomente `SESSION_COOKIE_SECURE=false`. Sem ela, o navegador descarta o cookie de login em HTTP e você volta sempre para a tela de login. `APP_PORT` troca a porta 80, se precisar;
- **com domínio:** descomente e preencha `DOMAIN` (o domínio do passo 1) e `ACME_EMAIL` (seu e-mail; o Let's Encrypt avisa por ele se o certificado tiver problema).

O arquivo `.env.production` fica só no servidor; ele nunca vai para o Git.

## 4. Subir

```bash
prumo up -d --build
```

A primeira vez leva alguns minutos (montar a imagem). Na ordem, o Compose:

1. sobe o Postgres;
2. roda o serviço `migrate`, que aplica as migrations e cria as categorias padrão, e termina;
3. sobe o app;
4. com domínio, sobe o Caddy, que pede o certificado HTTPS ao Let's Encrypt.

Para acompanhar: `prumo logs -f`.

## 5. Criar a sua conta

O Prumo tem uma conta só, criada pelo terminal (não existe tela de cadastro):

```bash
prumo run --rm migrate npm run auth:create-user
```

Ele pergunta o e-mail e a senha (pelo menos 12 caracteres; ela não aparece enquanto você digita). Depois, abra `http://IP-DO-SERVIDOR` (sem domínio) ou `https://prumo.seudominio.com` (com domínio) e entre.

**Esqueceu a senha?** O mesmo comando com `-- --reset-password` troca a senha, desbloqueia a conta e encerra todas as sessões:

```bash
prumo run --rm migrate npm run auth:create-user -- --reset-password
```

## 6. Agendar o backup

O `deploy/backup.sh` gera um dump compactado do banco em `/opt/prumo/backups` e guarda os 14 mais recentes (vale para os dois jeitos). Agende no `cron` do servidor (`crontab -e`):

```
0 3 * * * cd /opt/prumo && ./deploy/backup.sh >> backups/backup.log 2>&1
```

Vale copiar os backups para fora do servidor de vez em quando (outro computador ou um armazenamento na nuvem): se o VPS sumir, os backups dentro dele somem junto.

## Depois, com domínio

Quando tiver o domínio, o banco e os dados continuam os mesmos:

1. aponte o domínio para o servidor (passo 1) e libere a porta 443 (`sudo ufw allow 443`);
2. no `.env.production`, preencha `DOMAIN` e `ACME_EMAIL` e **apague** a linha `SESSION_COOKIE_SECURE=false`;
3. troque o atalho `prumo` pelo de "com domínio" e suba de novo: `prumo up -d --build`.

O app deixa de responder direto na porta 80 e passa a responder só pelo Caddy, em HTTPS. Como o cookie volta a ser `Secure`, entre de novo.

## Atualizar para uma versão nova

```bash
cd /opt/prumo
./deploy/backup.sh
git pull
prumo up -d --build
```

O serviço `migrate` aplica as migrations novas antes de o app novo subir.

## Restaurar um backup

```bash
cd /opt/prumo
prumo stop app
gunzip -c backups/prumo-AAAAMMDD-HHMMSS.sql.gz \
  | prumo exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
prumo start app
```

O dump apaga e recria as tabelas antes de inserir os dados, então o banco volta exatamente ao estado do backup.

## Problemas comuns

- **Sem domínio, o login volta para a tela de login:** falta `SESSION_COOKIE_SECURE=false` no `.env.production` (depois de pôr, `prumo up -d`).
- **O certificado não sai:** confira se o DNS já aponta para o servidor e se as portas 80 e 443 estão abertas (o Let's Encrypt precisa acessar a porta 80). Os logs do Caddy dizem o motivo: `prumo logs caddy`.
- **O app não sobe:** veja `prumo logs migrate app`. Se o `migrate` falhou, o app nem tenta subir.
- **Pouca memória durante o build:** em VPS de 1 GB, crie um arquivo de swap de 2 GB antes do primeiro `up --build`.

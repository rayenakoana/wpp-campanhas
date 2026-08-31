# Deploy do WPP Campanhas no VPS

Pré-requisito: o registro DNS A `wppcampanhas.costurandosucesso.com` -> `204.216.147.223` já criado no GoDaddy e propagado (confira com `nslookup wppcampanhas.costurandosucesso.com`).

## 1. Clonar o repositório no VPS

```bash
cd /opt
sudo git clone https://github.com/rayenakoana/wpp-campanhas.git
```

(Se o repo for privado, use um fine-grained token temporário na URL, como já fizemos antes, e depois revogue.)

## 2. Adicionar o serviço ao docker-compose.yml

Edite `~/automacao/docker-compose.yml` e adicione o bloco abaixo dentro da seção `services:`
(o conteúdo exato está em `docker-compose.snippet.yml`, gerado junto com este guia):

```yaml
  wpp-campanhas:
    build:
      context: /opt/wpp-campanhas
      dockerfile: Dockerfile
      args:
        VITE_SUPABASE_URL: https://syecwttpsvrmhdvinjmt.supabase.co
        VITE_SUPABASE_ANON_KEY: <anon_key_aqui>
    container_name: wpp-campanhas
    restart: unless-stopped
    networks:
      - automacao
```

Use o padrão seguro de edição já validado (para evitar corromper o YAML):

```bash
cd ~/automacao
grep -n "^services:" docker-compose.yml
# identifique a linha N do próximo serviço existente (ex: csdash) e insira antes dela
```

## 3. Build e subida do container

```bash
cd ~/automacao
docker compose build --no-cache wpp-campanhas
docker compose up -d wpp-campanhas
```

## 4. Confirmar que o container está de pé

```bash
docker ps | grep wpp-campanhas
docker logs wpp-campanhas --tail 50
```

## 5. Configurar o Proxy Host no Nginx Proxy Manager

Acesse `http://204.216.147.223:81` e:

1. **Hosts → Proxy Hosts → Add Proxy Host**
2. **Domain Names:** `wppcampanhas.costurandosucesso.com`
3. **Scheme:** `http`
4. **Forward Hostname/IP:** `wpp-campanhas` (nome do container, já que está na mesma rede Docker `automacao`)
5. **Forward Port:** `80`
6. Aba **SSL**: marque **Request a new SSL Certificate** + **Force SSL** + **HTTP/2 Support**
7. Preencha e-mail para o Let's Encrypt, aceite os termos, **Save**

## 6. Testar

Acesse `https://wppcampanhas.costurandosucesso.com` — deve carregar a tela de login.

---

**Nota de segurança:** a `VITE_SUPABASE_ANON_KEY` usada aqui é a chave pública (anon), segura para expor — a proteção real dos dados fica nas políticas RLS das tabelas do schema `wpp` no Supabase. Nunca use a `service_role` key no frontend.

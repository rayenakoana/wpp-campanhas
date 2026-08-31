# WPP Campanhas

Plataforma de disparo em massa de mensagens WhatsApp + rastreamento de conversões Meta CAPI, integrado ao RD Station CRM e Marketing, desenvolvida para a Costurando Sucesso.

## Status

Frontend React em desenvolvimento (Vite + React + TypeScript + Tailwind), conectado ao Supabase (schema `wpp`, mesmo projeto do CS Dash). Backend de disparo (N8N + Supabase) já em produção.

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind v4
- Roteamento: React Router
- Autenticação: Supabase Auth (projeto compartilhado com CS Dash), e-mail/senha + Google Workspace OAuth
- Dados: Supabase, schema `wpp`
- Backend de disparo: N8N (self-hosted) + WhatsApp Cloud API

## Estrutura

- `src/pages/Login.tsx` — tela de login
- `src/pages/dashboard/` — páginas do app (Desempenho, Segmentos e leads, Criar campanha, Campanhas, Radar de Conversões, Integrações, Configurações)
- `src/contexts/AuthContext.tsx` — autenticação
- `src/lib/supabase.ts` — clientes Supabase (auth + schema wpp)
- `prototype/` — protótipos HTML estáticos originais (referência visual, não usados em produção)

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencher com URL e anon key do Supabase
npm run dev
```

## Próximos passos

- Conectar as páginas do dashboard aos dados reais do schema `wpp`
- Sync de insights do Meta Ads (Gasto/CPL/ROAS) via N8N
- Ativar pixels de funis pendentes (Europa, China, C$ Club)
- Configurar forma de pagamento do WhatsApp Business (WABA)

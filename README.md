# WPP Campanhas

Plataforma de disparo em massa de mensagens WhatsApp + rastreamento de conversões Meta CAPI, integrado ao RD Station CRM e Marketing, desenvolvida para a Costurando Sucesso.

## Status

Protótipo visual completo (v5) navegável em HTML estático, com identidade visual glassmorphism (preto/vermelho/dourado, Barlow Condensed).

## Arquivos

- `login.html` — tela de login (e-mail/senha + SSO Google Workspace), ponto de entrada do app
- `wpp-campanhas-app-v5.html` — protótipo navegável completo: Desempenho, Segmentos e leads, Criar campanha, Campanhas, Radar de Conversões, Integrações, Configurações

## Stack planejada

- Frontend: React/TypeScript (a implementar, seguindo padrão do CS Dash)
- Backend: N8N (automações) + Supabase (schema `wpp`, projeto compartilhado com CS Dash)
- WhatsApp: Cloud API
- Autenticação: Supabase Auth (reaproveitando o mesmo projeto do CS Dash)

## Próximos passos

- Implementar frontend React conectado ao Supabase
- Sync de insights do Meta Ads (Gasto/CPL/ROAS)
- Ativar pixels de funis pendentes (Europa, China, C$ Club)

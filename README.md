# Famintoos TV

Painel e player para um canal interno formado exclusivamente por conteúdos cadastrados ou licenciados pela própria empresa.

## Desenvolvimento

```bash
npm install
copy .env.example .env.local
npm run dev
```

- Painel: `/`
- Tela pública: `/tv/<company_id>/<display_id>`

A tela pública começa com o botão neutro **Iniciar exibição**, necessário para liberar áudio/fullscreen. Depois da ativação, sem uma programação válida, ela permanece totalmente preta.

## Supabase

A migration em `supabase/migrations` cria o núcleo do Canal de TV, índices, RLS multiempresa e publicação Realtime. Ela exige as funções preexistentes `get_current_user_cnpj()` e `get_current_user_type()` e falha explicitamente se o projeto alvo não as tiver. A migration não remove objetos nem dados.

O frontend aceita somente URL e chave publicável. A consulta do player está centralizada na RPC `get_tv_player_payload`, que deve ser implementada no backend do projeto alvo depois de confirmar o schema real de TVs/autenticação. O payload deve retornar `companyId`, `displayId`, `items`, `interruptions` e `syncedAt`; a resposta é novamente validada pelo escopo da rota.

## Mídia e Cloudflare R2

`resolveMediaUrl(media)` preserva `media_url` e suporta `cloudflare_r2`, `supabase_storage` e `external_url`. Novos uploads R2 devem passar pelo backend autenticado e usar chaves no formato `tv/<company_id>/<media_type>/<uuid>/<filename>`. Nunca configure credenciais R2 em variáveis `VITE_*`.

## Vercel e Fire TV

Na Vercel, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; configure os segredos R2 apenas no backend de upload. Para Fire TV, abra a URL pública da TV, clique em **Iniciar exibição** e valide vídeo, áudio, chamada durante vídeo e retomada. O player mantém apenas um vídeo ativo, carrega o conteúdo corrente e isola o cache por empresa e TV.

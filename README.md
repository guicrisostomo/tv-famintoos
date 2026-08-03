# Famintoos TV

Painel e player para um canal interno formado exclusivamente por conteúdos cadastrados ou licenciados pela própria empresa.

## Desenvolvimento

```bash
npm install
copy .env.example .env.local
npm run dev
```

- Painel: `/`
- Tela pública: `/tv/<display_id>` (a empresa é obtida da sessão autenticada). A URL antiga `/tv/<company_id>/<display_id>` continua compatível.

A tela pública começa com o botão neutro **Iniciar exibição**, necessário para liberar áudio/fullscreen. Depois da ativação, sem uma programação válida, ela permanece totalmente preta.

## Supabase

A migration em `supabase/migrations` cria o núcleo do Canal de TV, índices, RLS multiempresa e publicação Realtime. Ela exige as funções preexistentes `get_current_user_cnpj()` e `get_current_user_type()` e falha explicitamente se o projeto alvo não as tiver. A migration não remove objetos nem dados.

O acesso ao painel e à tela pública exige uma sessão Supabase válida. A empresa é derivada exclusivamente de `auth.users.id -> tb_user.uid -> tb_user.cnpj`, considerando apenas usuários com `fg_ativo = true`. O CNPJ recebido em rota, formulário ou payload nunca concede acesso. A migration `enforce_tv_authenticated_company_scope` remove o bypass de administrador geral nas tabelas do Canal e restringe também os metadados R2 à empresa autenticada.

O frontend aceita somente URL e chave publicável. A consulta do player está centralizada na RPC `get_tv_player_payload`, que deve ser implementada no backend do projeto alvo depois de confirmar o schema real de TVs/autenticação. O payload deve retornar `companyId`, `displayId`, `items`, `interruptions` e `syncedAt`; a resposta é novamente validada pelo escopo da rota.

## Mídia e Cloudflare R2

`resolveMediaUrl(media)` preserva `media_url` e suporta `cloudflare_r2`, `supabase_storage` e `external_url`. Novos uploads R2 devem passar pelo backend autenticado e usar chaves no formato `tv/<company_id>/<media_type>/<uuid>/<filename>`. Nunca configure credenciais R2 em variáveis `VITE_*`.

O backend deve expor `GET /api/tv/media/health`, autenticado, retornando `2xx` quando a conexão R2 estiver operacional, e `POST /api/tv/media/upload-ticket` para URLs pré-assinadas. Falhas do Supabase ou desses endpoints são apresentadas no painel; o frontend nunca recebe as credenciais S3.

Essas duas Vercel Functions estão em `api/tv/media`. O bucket R2 precisa de CORS permitindo `PUT` a partir dos domínios de produção/preview, com o header `Content-Type`. As URLs de upload expiram em cinco minutos e são sempre limitadas ao prefixo da empresa autenticada.

## Vercel e Fire TV

Na Vercel, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; configure os segredos R2 apenas no backend de upload. Para Fire TV, abra a URL pública da TV, clique em **Iniciar exibição** e valide vídeo, áudio, chamada durante vídeo e retomada. O player mantém apenas um vídeo ativo, carrega o conteúdo corrente e isola o cache por empresa e TV.

Um site aberto no Amazon Silk não consegue impedir completamente que o Fire TV retorne à tela inicial, encerre o navegador ou suspenda a página por inatividade: essa decisão pertence ao sistema operacional. Para operação contínua, use preferencialmente um navegador com modo quiosque e políticas de permanência de tela ou um aplicativo Android dedicado com *wake lock* e execução supervisionada. O player reduz o impacto dessas suspensões restaurando a última programação, posição e tempo do vídeo quando a página volta ao primeiro plano.

O diagnóstico fica oculto em operação normal. Para uma inspeção temporária, acrescente `?diagnostic=player` à URL da TV; a tela mostra recursos aproximados, subscriptions, timers gerenciados, reconexões, último erro, última mídia e motivo do último reload.

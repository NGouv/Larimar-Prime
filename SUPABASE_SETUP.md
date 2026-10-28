# Configuração do painel Larimar Prime

## Arquitetura

O site continua em HTML, CSS e JavaScript sem framework. O navegador carrega o cliente oficial do Supabase sob demanda via esm.sh para autenticação, consultas e Storage. A função `api/config.js` disponibiliza somente a URL do projeto e a chave pública (anon) configuradas como variáveis de ambiente da Vercel. Nenhuma chave `service_role` é usada ou deve ser adicionada ao projeto.

As permissões de leitura e escrita são aplicadas no PostgreSQL e no Storage por RLS; ocultar o painel no navegador não é a proteção dos dados.

## Configuração inicial do Supabase

1. Crie ou selecione o projeto Supabase e confirme que ele não contém tabelas ou políticas com estes nomes antes de executar a configuração.
2. No SQL Editor do Supabase, execute `supabase/schema.sql`. O script cria `admin_users`, `properties`, índices, trigger, políticas RLS e o bucket privado `property-images`. Ele não apaga imóveis nem objetos existentes. Se já existir um bucket com esse identificador, o script não altera suas configurações: confirme que ele continua privado e aceita apenas JPEG, PNG e WebP de até 10 MB.
   - Se a política anterior `Visitors can read published property images` já tiver sido aplicada, execute `supabase/migrations/20261028_restrict_published_property_image_reads.sql` no SQL Editor para substituí-la pela regra que só permite ler arquivos listados na galeria de imóveis publicados.
3. Em Authentication → URL Configuration, defina a URL do site publicado e adicione `https://SEU-DOMINIO/admin.html` à lista de redirecionamentos permitidos. Isso também habilita o link de recuperação de senha.
4. Desative o cadastro público de usuários em Authentication → Sign In / Providers → Email. O painel não possui tela de cadastro.
5. Convide ou crie o primeiro usuário proprietário em Authentication → Users. Depois de criado, autorize-o no SQL Editor, substituindo o e-mail pelo endereço real da conta:

   ```sql
   insert into public.admin_users (user_id)
   select id
   from auth.users
   where lower(email) = lower('SUBSTITUA-PELO-EMAIL-DO-PROPRIETARIO')
   on conflict (user_id) do nothing;
   ```

   Confirme que a inserção incluiu exatamente uma conta autorizada. Só operadores com acesso ao projeto Supabase devem modificar `admin_users`.

## Configuração da Vercel

Adicione estas variáveis em Project Settings → Environment Variables, para os ambientes desejados:

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública anon do projeto Supabase |

A chave anon é pública e será retornada por `/api/config`; RLS precisa estar ativo. Não configure nem exponha uma chave `service_role`. O arquivo `.env.example` lista os nomes sem valores. Para desenvolvimento com Vercel CLI, copie o exemplo para `.env.local`, preencha os valores e execute `vercel dev`; nunca publique `.env.local`.

## Operação do painel

1. Abra `/admin.html` e entre com a conta que foi autorizada em `admin_users`.
2. Use **Novo imóvel**, preencha os campos obrigatórios e adicione fotos JPG, PNG ou WebP de até 10 MB. Escolha uma imagem de capa; até 20 fotos podem ser selecionadas.
3. Salve como rascunho ou publicado. A publicação requer uma capa e ao menos uma foto.
4. Use **Editar** para atualizar os dados e manter as fotos existentes. A galeria permite definir a capa, remover e reordenar fotos. Remover fotos do formulário só apaga os objetos do Storage depois que a atualização do anúncio for salva.
5. Use **Publicar/Despublicar** para alterar a visibilidade. **Excluir** pede confirmação e remove o anúncio antes de tentar limpar suas imagens.
6. **Recuperar senha** envia o fluxo padrão do Supabase Auth para o e-mail informado. O envio depende do provedor de e-mail e das URLs permitidas no projeto.

O catálogo público lista apenas anúncios publicados. As fotos ficam em bucket privado e são exibidas por URLs assinadas; políticas permitem leitura somente de fotos pertencentes a imóveis publicados ou a um administrador autenticado. Detalhes de anúncios em rascunho não são retornados ao público.

## Verificação e limites conhecidos

- Não há credenciais ou projeto Supabase fornecidos neste workspace; login, banco, e-mail e upload real precisam ser verificados após configurar o projeto.
- O site público deixa de usar os três anúncios ilustrativos do `script.js`. Enquanto não houver imóveis publicados, mostra “Estamos preparando nossos imóveis para você.”
- Execute o SQL em um projeto de teste primeiro e configure um usuário administrador real. Não use dados ilustrativos como anúncios reais.
- Teste login autorizado e não autorizado, recuperação, upload, edição, publicação, despublicação e exclusão no projeto configurado. Confirme também as larguras 320, 375, 768, 1024 e 1440 px.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "Admins can read their own authorization"
  on public.admin_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 180),
  property_type text not null check (
    property_type in ('casa', 'apartamento', 'cobertura', 'terreno', 'comercial', 'outro')
  ),
  purpose text not null check (purpose in ('venda', 'locacao', 'venda_locacao')),
  neighborhood text not null check (length(trim(neighborhood)) between 1 and 120),
  city text not null check (length(trim(city)) between 1 and 100),
  state char(2) not null check (state ~ '^[A-Z]{2}$'),
  price numeric(14, 2) check (price is null or price >= 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  parking_spaces integer check (parking_spaces is null or parking_spaces >= 0),
  area_sqm numeric(12, 2) check (area_sqm is null or area_sqm >= 0),
  description text not null check (length(trim(description)) between 1 and 10000),
  features text[] not null default '{}',
  gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(gallery) = 'array'),
  cover_image_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (
    cover_image_path is null
    or gallery @> jsonb_build_array(jsonb_build_object('path', cover_image_path))
  ),
  check (
    status <> 'published'
    or (cover_image_path is not null and jsonb_array_length(gallery) > 0)
  )
);

create index if not exists properties_publication_order_idx
  on public.properties (published_at desc, created_at desc)
  where status = 'published';

create index if not exists properties_admin_order_idx
  on public.properties (created_at desc);

create or replace function public.set_property_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      new.published_at = now();
    elsif new.published_at is null or old.status is distinct from 'published' then
      new.published_at = now();
    end if;
  else
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_property_timestamps on public.properties;
create trigger set_property_timestamps
  before insert or update on public.properties
  for each row execute function public.set_property_timestamps();

alter table public.properties enable row level security;

create policy "Anyone can read published properties"
  on public.properties
  for select
  to anon, authenticated
  using (status = 'published');

create policy "Admins can read all properties"
  on public.properties
  for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can create properties"
  on public.properties
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update properties"
  on public.properties
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete properties"
  on public.properties
  for delete
  to authenticated
  using ((select public.is_admin()));

grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;
grant select on public.admin_users to authenticated;
grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Visitors can read published property images"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1
      from public.properties
      where properties.id::text = split_part(storage.objects.name, '/', 1)
        and properties.status = 'published'
    )
  );

create policy "Admins can read property images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'property-images'
    and (select public.is_admin())
  );

create policy "Admins can upload property images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'property-images'
    and (select public.is_admin())
  );

create policy "Admins can update property images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'property-images'
    and (select public.is_admin())
  )
  with check (
    bucket_id = 'property-images'
    and (select public.is_admin())
  );

create policy "Admins can delete property images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'property-images'
    and (select public.is_admin())
  );

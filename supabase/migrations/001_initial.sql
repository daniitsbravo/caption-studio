-- CaptionStudio — migración inicial
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase.

-- ============================================================
-- Tabla: profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Los usuarios ven su propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Los usuarios actualizan su propio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- El perfil se crea automáticamente al registrarse (trigger security definer,
-- por eso no hace falta política de INSERT para el rol authenticated)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Tabla: captions
-- ============================================================
create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_url text not null,
  image_name text,
  caption text not null,
  hashtags text[] not null default '{}',
  is_carousel boolean not null default false,
  carousel_image_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists captions_user_created_idx
  on public.captions (user_id, created_at desc);

alter table public.captions enable row level security;

create policy "Los usuarios ven sus propios captions"
  on public.captions for select
  using (auth.uid() = user_id);

create policy "Los usuarios crean sus propios captions"
  on public.captions for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios actualizan sus propios captions"
  on public.captions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Los usuarios eliminan sus propios captions"
  on public.captions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Storage: bucket caption-images
-- (lectura pública, escritura solo del propietario en su carpeta /{user_id}/...)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('caption-images', 'caption-images', true)
on conflict (id) do nothing;

create policy "Lectura pública de caption-images"
  on storage.objects for select
  using (bucket_id = 'caption-images');

create policy "Subida autenticada a carpeta propia"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'caption-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Borrado de archivos propios"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'caption-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

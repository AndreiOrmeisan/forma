-- Run in the Supabase SQL editor for YOUR project. No data is dropped.
begin;

create table if not exists public.forma_projects (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    revision integer not null default 1 check (revision > 0)
);
create index if not exists forma_projects_owner_updated
    on public.forma_projects(owner_id, updated_at desc, id asc);

create or replace function public.forma_project_updated()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
    new.revision := old.revision + 1;
    return new;
end;
$$;
drop trigger if exists forma_project_updated on public.forma_projects;
create trigger forma_project_updated before update on public.forma_projects
    for each row execute function public.forma_project_updated();

alter table public.forma_projects enable row level security;
alter table public.forma_projects force row level security;
revoke all on public.forma_projects from anon, authenticated;
grant select, delete on public.forma_projects to authenticated;
grant insert (id, owner_id, payload) on public.forma_projects to authenticated;
grant update (payload) on public.forma_projects to authenticated;

drop policy if exists forma_owner_select on public.forma_projects;
create policy forma_owner_select on public.forma_projects for select to authenticated
    using ((select auth.uid()) = owner_id);
drop policy if exists forma_owner_insert on public.forma_projects;
create policy forma_owner_insert on public.forma_projects for insert to authenticated
    with check ((select auth.uid()) = owner_id);
drop policy if exists forma_owner_update on public.forma_projects;
create policy forma_owner_update on public.forma_projects for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists forma_owner_delete on public.forma_projects;
create policy forma_owner_delete on public.forma_projects for delete to authenticated
    using ((select auth.uid()) = owner_id);

commit;

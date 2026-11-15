-- SecurityLab proposed cloud schema (NOT applied to any hosted project).
-- PostgreSQL / Supabase. Stage 1 is entirely local; use only after design/security review.
-- IMPORTANT: Uploaded assessment scores are NEVER treated as certified results.

create table if not exists public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 created_at timestamptz not null default now()
);
create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 150),
 scenario_id text not null,
 schema_version integer not null default 1 check(schema_version > 0),
 current_revision integer not null default 0 check(current_revision>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists projects_owner_updated_idx on public.projects(owner_id,updated_at desc);
create table if not exists public.project_revisions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 revision integer not null check(revision>=1),
 document jsonb not null check(jsonb_typeof(document)='object'),
 content_hash text not null check(length(content_hash)=64),
 created_at timestamptz not null default now(),
 unique(project_id,revision)
);
create index if not exists revisions_project_idx on public.project_revisions(project_id,revision desc);
create table if not exists public.scenarios (
 id text primary key,
 version integer not null check(version>=1),
 name text not null,
 definition jsonb not null check(jsonb_typeof(definition)='object'),
 is_published boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.attempts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 scenario_id text not null references public.scenarios(id),
 scenario_version integer not null check(scenario_version>=1),
 status text not null default 'in_progress' check(status in ('in_progress','submitted','reviewed')),
 started_at timestamptz not null default now(),
 submitted_at timestamptz
);
create index if not exists attempts_owner_idx on public.attempts(owner_id,started_at desc);
create table if not exists public.assessment_results (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null unique references public.attempts(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 rubric_version integer not null check(rubric_version>=1),
 score integer not null check(score between 0 and 100),
 passed boolean not null,
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 evaluated_at timestamptz not null default now()
);
create table if not exists public.device_profiles (
 id text primary key,
 manufacturer text not null,
 model_identifier text not null,
 profile_revision integer not null check(profile_revision>=1),
 profile jsonb not null check(jsonb_typeof(profile)='object'),
 source_url text,
 verification_status text not null default 'unverified' check(verification_status in ('unverified','reviewed','deprecated')),
 is_published boolean not null default false,
 reviewed_at timestamptz
);

-- Enable RLS for EVERY exposed public table.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_revisions enable row level security;
alter table public.scenarios enable row level security;
alter table public.attempts enable row level security;
alter table public.assessment_results enable row level security;
alter table public.device_profiles enable row level security;

-- Explicit grants are complementary to RLS; no anonymous writes.
revoke all on public.profiles,public.projects,public.project_revisions,public.scenarios,public.attempts,public.assessment_results,public.device_profiles from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.projects to authenticated;
grant select,insert on public.project_revisions to authenticated;
grant select on public.scenarios,public.device_profiles to anon,authenticated;
grant select,insert,update on public.attempts to authenticated;
grant select on public.assessment_results to authenticated;

create policy "own profile read" on public.profiles for select to authenticated using (user_id=(select auth.uid()));
create policy "own profile create" on public.profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy "own profile edit" on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "own projects read" on public.projects for select to authenticated using(owner_id=(select auth.uid()));
create policy "own projects create" on public.projects for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "own projects edit" on public.projects for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "own projects delete" on public.projects for delete to authenticated using(owner_id=(select auth.uid()));
create policy "own revisions read" on public.project_revisions for select to authenticated
 using(exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy "own revisions append" on public.project_revisions for insert to authenticated
 with check(author_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy "published scenarios read" on public.scenarios for select to anon,authenticated using(is_published=true);
create policy "published devices read" on public.device_profiles for select to anon,authenticated using(is_published=true);
create policy "own attempts read" on public.attempts for select to authenticated using(owner_id=(select auth.uid()));
create policy "own attempts create" on public.attempts for insert to authenticated
 with check(owner_id=(select auth.uid()) and status='in_progress' and submitted_at is null
   and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy "own attempts update" on public.attempts for update to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid())
   and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy "own assessment results read" on public.assessment_results for select to authenticated
 using(owner_id=(select auth.uid()));
-- There is deliberately NO authenticated INSERT/UPDATE/DELETE grant or policy for
-- assessment_results. Future certified assessments require trusted server-side
-- re-simulation, signed rubric versions, authenticated provenance and review.
-- Cloud sync must use a reviewed atomic compare-and-swap operation for current_revision;
-- this schema alone DOES NOT implement conflict-safe synchronization.

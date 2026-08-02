-- Phase 4C.1.1
-- Guided exercise identifiers are strings such as "home-f-j-1".
-- Store them as text[] so mastery can round-trip across devices.
alter table public.lesson_mastery
  alter column passed_exercises drop default;

alter table public.lesson_mastery
  alter column passed_exercises type text[]
  using passed_exercises::text[];

alter table public.lesson_mastery
  alter column passed_exercises set default '{}'::text[];

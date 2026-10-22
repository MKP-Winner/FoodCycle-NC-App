create extension if not exists pgcrypto with schema extensions;

create table if not exists public.food_items (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 70),
  category text not null,
  amount text not null,
  unit text not null,
  location text not null,
  best_by date not null,
  note text not null default '',
  status text not null check (status in ('active', 'archived')),
  disposition text check (disposition in ('used', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.share_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 70),
  quantity text not null,
  unit text not null,
  pickup_area text not null check (char_length(pickup_area) between 1 and 70),
  destination text not null default '',
  pickup_date date not null,
  pickup_window text not null,
  handling_notes text not null default '',
  allergens text not null default '',
  dietary_notes text not null default '',
  status text not null default 'open' check (status in ('open', 'requested', 'confirmed', 'completed', 'cancelled')),
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'open' and claimed_by is null) or (status <> 'open' and (claimed_by is not null or status = 'cancelled')))
);

create table if not exists public.listing_private_details (
  listing_id uuid primary key references public.share_listings(id) on delete cascade,
  exact_address text not null check (char_length(exact_address) between 1 and 120),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_handoff_secrets (
  listing_id uuid primary key references public.share_listings(id) on delete cascade,
  code_salt bytea not null check (octet_length(code_salt) = 16),
  code_hash bytea not null check (octet_length(code_hash) = 32),
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.impact_events (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null,
  label text not null,
  detail text not null default '',
  pounds numeric(10, 2) not null default 0 check (pounds >= 0),
  pickups integer not null default 0 check (pickups >= 0),
  hours numeric(7, 2) not null default 0 check (hours >= 0),
  requests integer not null default 0 check (requests >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pantry_needs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  pantry_name text not null check (char_length(pantry_name) between 1 and 100),
  area_label text not null check (char_length(area_label) between 1 and 100),
  item text not null check (char_length(item) between 1 and 100),
  quantity text not null check (char_length(quantity) between 1 and 80),
  urgency text not null check (char_length(urgency) between 1 and 80),
  status text not null default 'open' check (status in ('open', 'fulfilled', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.pantry_needs(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed')),
  created_at timestamptz not null default now(),
  unique (need_id, requester_id)
);

alter table public.food_items enable row level security;
alter table public.share_listings enable row level security;
alter table public.listing_private_details enable row level security;
alter table public.listing_handoff_secrets enable row level security;
alter table public.impact_events enable row level security;
alter table public.pantry_needs enable row level security;
alter table public.transfer_requests enable row level security;

create policy "Owners manage their food items"
  on public.food_items for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Authenticated users see open and involved listings"
  on public.share_listings for select to authenticated
  using (status = 'open' or owner_id = auth.uid() or claimed_by = auth.uid());

create policy "Only involved parties see private pickup details"
  on public.listing_private_details for select to authenticated
  using (
    exists (
      select 1 from public.share_listings listing
      where listing.id = listing_private_details.listing_id
        and (listing.owner_id = auth.uid() or (listing.status in ('confirmed', 'completed') and listing.claimed_by = auth.uid()))
    )
  );

create policy "Only listing owners can see handoff codes"
  on public.listing_handoff_secrets for select to authenticated
  using (
    exists (
      select 1 from public.share_listings listing
      where listing.id = listing_handoff_secrets.listing_id and listing.owner_id = auth.uid()
    )
  );

create policy "Owners manage their impact events"
  on public.impact_events for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Authenticated users see open pantry needs and their own"
  on public.pantry_needs for select to authenticated
  using (status = 'open' or created_by = auth.uid());

create policy "Users manage their own pantry needs"
  on public.pantry_needs for insert to authenticated
  with check (created_by = auth.uid());

create policy "Need owners update their needs"
  on public.pantry_needs for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "Need owners delete their needs"
  on public.pantry_needs for delete to authenticated
  using (created_by = auth.uid());

create policy "Requesters and need owners see transfer requests"
  on public.transfer_requests for select to authenticated
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from public.pantry_needs need
      where need.id = transfer_requests.need_id and need.created_by = auth.uid()
    )
  );

create policy "Authenticated users request open pantry needs"
  on public.transfer_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1 from public.pantry_needs need
      where need.id = transfer_requests.need_id
        and need.status = 'open'
        and need.created_by <> auth.uid()
    )
  );

revoke all on public.food_items, public.share_listings, public.listing_private_details,
  public.listing_handoff_secrets, public.impact_events, public.pantry_needs,
  public.transfer_requests from anon, authenticated;

grant select, insert, update, delete on public.food_items to authenticated;
grant select on public.share_listings to authenticated;
grant select on public.listing_private_details to authenticated;
grant select (listing_id, failed_attempts, locked_at) on public.listing_handoff_secrets to authenticated;
grant select, insert, update, delete on public.impact_events to authenticated;
grant select, insert, update, delete on public.pantry_needs to authenticated;
grant select on public.transfer_requests to authenticated;
grant insert (need_id, requester_id) on public.transfer_requests to authenticated;

create or replace function public.create_share_listing(
  p_name text,
  p_quantity text,
  p_unit text,
  p_pickup_area text,
  p_exact_address text,
  p_destination text,
  p_pickup_date date,
  p_pickup_window text,
  p_handling_notes text,
  p_allergens text,
  p_dietary_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_listing_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before posting a pickup listing.';
  end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_pickup_area), '') is null or nullif(trim(p_exact_address), '') is null then
    raise exception 'Food name, public pickup area, and exact pickup address are required.';
  end if;
  if p_pickup_date < current_date then
    raise exception 'Pickup date cannot be in the past.';
  end if;

  insert into public.share_listings (
    owner_id, name, quantity, unit, pickup_area, destination, pickup_date,
    pickup_window, handling_notes, allergens, dietary_notes
  ) values (
    auth.uid(), trim(p_name), trim(p_quantity), trim(p_unit), trim(p_pickup_area),
    coalesce(trim(p_destination), ''), p_pickup_date, trim(p_pickup_window),
    coalesce(trim(p_handling_notes), ''), coalesce(trim(p_allergens), ''),
    coalesce(trim(p_dietary_notes), '')
  ) returning id into new_listing_id;

  insert into public.listing_private_details (listing_id, exact_address)
  values (new_listing_id, trim(p_exact_address));

  return new_listing_id;
end;
$$;

create or replace function public.request_pickup(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before requesting a pickup.';
  end if;
  update public.share_listings
  set status = 'requested', claimed_by = auth.uid(), updated_at = now()
  where id = p_listing_id and status = 'open' and owner_id <> auth.uid();
  if not found then
    raise exception 'This pickup is no longer open or cannot be claimed by its donor.';
  end if;
end;
$$;

create or replace function public.confirm_pickup(p_listing_id uuid, p_handoff_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_salt_value bytea := extensions.gen_random_bytes(16);
begin
  if auth.uid() is null then
    raise exception 'Sign in before confirming a pickup.';
  end if;
  if p_handoff_code is null or p_handoff_code !~ '^[0-9]{8}$' then
    raise exception 'The handoff code must contain 8 digits.';
  end if;
  update public.share_listings
  set status = 'confirmed', updated_at = now()
  where id = p_listing_id
    and owner_id = auth.uid()
    and (
      status = 'requested'
      or status = 'confirmed'
    );
  if not found then
    raise exception 'Only the listing owner can confirm a pending pickup request.';
  end if;
  insert into public.listing_handoff_secrets (listing_id, code_salt, code_hash)
  values (
    p_listing_id,
    code_salt_value,
    extensions.digest(
      code_salt_value || convert_to(p_handoff_code, 'UTF8'),
      'sha256'
    )
  )
  on conflict (listing_id) do update
  set code_salt = excluded.code_salt,
      code_hash = excluded.code_hash,
      failed_attempts = 0,
      locked_at = null,
      updated_at = now();
end;
$$;

create or replace function public.complete_pickup(p_listing_id uuid, p_handoff_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_listing public.share_listings%rowtype;
  handoff_secret public.listing_handoff_secrets%rowtype;
  amount_value numeric := 0;
  estimated_pounds numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in before completing a pickup.';
  end if;
  select * into completed_listing
  from public.share_listings listing
  where listing.id = p_listing_id
    and listing.claimed_by = auth.uid()
    and listing.status = 'confirmed'
  for update;
  if not found then
    raise exception 'Handoff code is incorrect or this pickup is not confirmed for your account.';
  end if;
  select * into handoff_secret
  from public.listing_handoff_secrets secret
  where secret.listing_id = p_listing_id
  for update;
  if not found then
    raise exception 'Handoff code is not available for this pickup.';
  end if;
  if handoff_secret.locked_at is not null then
    raise exception 'Too many incorrect handoff attempts. Ask the donor to issue a new confirmation.';
  end if;
  if p_handoff_code is null or handoff_secret.code_hash <> extensions.digest(
    handoff_secret.code_salt || convert_to(p_handoff_code, 'UTF8'),
    'sha256'
  ) then
    update public.listing_handoff_secrets
    set failed_attempts = least(failed_attempts + 1, 5),
        locked_at = case when failed_attempts + 1 >= 5 then now() else null end,
        updated_at = now()
    where listing_id = p_listing_id;
    return false;
  end if;
  update public.share_listings
  set status = 'completed', updated_at = now()
  where id = p_listing_id and claimed_by = auth.uid() and status = 'confirmed';

  if completed_listing.quantity ~ '^[0-9]+([.][0-9]+)?$' then
    amount_value := completed_listing.quantity::numeric;
  end if;
  estimated_pounds := case lower(trim(completed_listing.unit))
    when 'lb' then amount_value
    when 'lbs' then amount_value
    when 'kg' then amount_value * 2.205
    when 'oz' then amount_value / 16
    when 'g' then amount_value / 453.6
    when 'each' then amount_value * 0.5
    when 'items' then amount_value * 0.5
    else 0
  end;

  insert into public.impact_events (id, owner_id, occurred_on, label, detail, pounds, pickups)
  values
    (gen_random_uuid(), completed_listing.owner_id, current_date, 'Pickup completed: ' || completed_listing.name, 'Handoff confirmed by volunteer.', estimated_pounds, 1),
    (gen_random_uuid(), completed_listing.claimed_by, current_date, 'Pickup completed: ' || completed_listing.name, 'Handoff confirmed by donor.', estimated_pounds, 1);
  return true;
end;
$$;

revoke all on function public.create_share_listing(text, text, text, text, text, text, date, text, text, text, text) from public;
revoke all on function public.request_pickup(uuid) from public;
revoke all on function public.confirm_pickup(uuid, text) from public;
revoke all on function public.complete_pickup(uuid, text) from public;
grant execute on function public.create_share_listing(text, text, text, text, text, text, date, text, text, text, text) to authenticated;
grant execute on function public.request_pickup(uuid) to authenticated;
grant execute on function public.confirm_pickup(uuid, text) to authenticated;
grant execute on function public.complete_pickup(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'share_listings') then
      alter publication supabase_realtime add table public.share_listings;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pantry_needs') then
      alter publication supabase_realtime add table public.pantry_needs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'food_items') then
      alter publication supabase_realtime add table public.food_items;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transfer_requests') then
      alter publication supabase_realtime add table public.transfer_requests;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listing_handoff_secrets') then
      alter publication supabase_realtime add table public.listing_handoff_secrets;
    end if;
  end if;
end;
$$;

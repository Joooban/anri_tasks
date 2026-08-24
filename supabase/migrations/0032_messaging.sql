-- Lightweight internal messaging: DMs and small group chats. Client
-- feedback: "they want to have its own messaging system inside of it" —
-- scoped down to DMs/small groups + an unread badge, tied to the existing
-- people/departments already in the app (confirmed with the user).
--
-- No Supabase Realtime here on purpose: message bodies are encrypted at
-- the application layer (matching task titles/comments/announcements —
-- see src/lib/encryption.ts), and the encryption key never reaches the
-- browser. Postgres changes streamed directly to a subscribed client would
-- be raw ciphertext the browser has no way to decrypt. The app instead
-- polls a Server Action every few seconds while a conversation is open —
-- same decrypt-on-the-server pattern as every other page here, just
-- refreshed periodically rather than pushed instantly. A genuine
-- push-realtime version would need server-side broadcast (decrypt, then
-- push over a Realtime channel) rather than raw postgres_changes — a
-- larger undertaking, not attempted here.
create table conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);
create index conversation_participants_profile_id_idx on conversation_participants(profile_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_id_created_at_idx on messages(conversation_id, created_at);

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

-- Deliberately private — unlike tasks (where Boss/Supervisor can see
-- everything via is_boss_or_supervisor()), messaging has no admin
-- visibility bypass. This is a new, distinct privacy stance from the
-- task-visibility model, chosen because "messaging" implies the normal
-- privacy expectation of a DM/group chat, not something meant to be
-- broadly visible.
create or replace function is_conversation_participant(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and profile_id = auth.uid()
  );
$$;
grant execute on function is_conversation_participant(uuid) to authenticated;

create policy conversations_select on conversations for select
  to authenticated using (is_conversation_participant(id));

create policy conversation_participants_select on conversation_participants for select
  to authenticated using (is_conversation_participant(conversation_id));

create policy messages_select on messages for select
  to authenticated using (is_conversation_participant(conversation_id));

-- No write policies on any of the three tables — RPC-only, matching the
-- established convention (see PROJECT_CONTEXT.md: RLS WITH CHECK policies
-- involving a lookup have a documented history of silently rejecting
-- valid writes in this project).

create or replace function create_conversation_rpc(p_participant_ids uuid[], p_is_group boolean, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_conversation_id uuid;
  v_participant uuid;
  v_all_participants uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if array_length(p_participant_ids, 1) is null or array_length(p_participant_ids, 1) < 1 then
    raise exception 'At least one other participant is required';
  end if;

  v_all_participants := array(select distinct x from unnest(array_append(p_participant_ids, auth.uid())) as x);

  -- Reuse an existing 1:1 DM between exactly these two people instead of
  -- creating a duplicate every time "message this person" is clicked.
  if not p_is_group and array_length(p_participant_ids, 1) = 1 then
    select cp1.conversation_id into v_conversation_id
    from conversation_participants cp1
    join conversation_participants cp2 on cp2.conversation_id = cp1.conversation_id
    join conversations c on c.id = cp1.conversation_id
    where c.is_group = false
      and cp1.profile_id = auth.uid()
      and cp2.profile_id = p_participant_ids[1]
      and (select count(*) from conversation_participants where conversation_id = cp1.conversation_id) = 2
    limit 1;

    if v_conversation_id is not null then
      return v_conversation_id;
    end if;
  end if;

  insert into conversations (is_group, name, created_by)
  values (p_is_group, nullif(trim(coalesce(p_name, '')), ''), auth.uid())
  returning id into v_conversation_id;

  foreach v_participant in array v_all_participants loop
    insert into conversation_participants (conversation_id, profile_id) values (v_conversation_id, v_participant)
    on conflict do nothing;
  end loop;

  return v_conversation_id;
end;
$$;
grant execute on function create_conversation_rpc(uuid[], boolean, text) to authenticated;

create or replace function send_message_rpc(p_conversation_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_message_id uuid;
begin
  if not is_conversation_participant(p_conversation_id) then
    raise exception 'Not a participant in this conversation';
  end if;
  if trim(p_body) = '' then
    raise exception 'Message cannot be empty';
  end if;

  insert into messages (conversation_id, sender_id, body) values (p_conversation_id, auth.uid(), p_body)
  returning id into v_message_id;

  update conversations set last_message_at = now() where id = p_conversation_id;

  -- Sending implies having seen everything up to now — without this, the
  -- sender's own conversation list would show their own conversation as
  -- unread immediately after they post in it.
  update conversation_participants set last_read_at = now()
    where conversation_id = p_conversation_id and profile_id = auth.uid();

  return v_message_id;
end;
$$;
grant execute on function send_message_rpc(uuid, text) to authenticated;

create or replace function mark_conversation_read_rpc(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_conversation_participant(p_conversation_id) then
    raise exception 'Not a participant in this conversation';
  end if;
  update conversation_participants set last_read_at = now()
    where conversation_id = p_conversation_id and profile_id = auth.uid();
end;
$$;
grant execute on function mark_conversation_read_rpc(uuid) to authenticated;

create or replace function get_unread_message_count_rpc() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(count(*)::int, 0)
  from messages m
  join conversation_participants cp on cp.conversation_id = m.conversation_id and cp.profile_id = auth.uid()
  where m.sender_id <> auth.uid()
    and (cp.last_read_at is null or m.created_at > cp.last_read_at);
$$;
grant execute on function get_unread_message_count_rpc() to authenticated;

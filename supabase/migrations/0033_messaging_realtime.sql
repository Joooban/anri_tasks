-- Upgrades messaging from polling to instant push, without ever putting
-- message content (encrypted or otherwise) through Realtime. Confirmed
-- against current Supabase docs before writing this (supabase.com/docs/
-- guides/realtime/authorization, /broadcast) rather than guessing at the
-- API — this is Broadcast from Database, not raw postgres_changes.
--
-- The trigger below broadcasts only a pointer — {conversation_id,
-- message_id} — over a private channel named "conversation:<id>". No
-- message body, encrypted or not, ever goes near Realtime. The client
-- (message-thread.tsx) receives that ping and calls the existing
-- fetchMessages Server Action to get the real, decrypted content — same
-- decrypt-on-the-server path as before, just triggered by a push instead
-- of a timer. This also means there's nothing new to keep in sync with
-- src/lib/encryption.ts if that ever changes.
--
-- realtime.messages already has RLS enabled by default (per the docs —
-- no ALTER TABLE needed, and Supabase manages that table's ownership).
create policy "conversation participants can receive their broadcasts"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and split_part(realtime.topic(), ':', 1) = 'conversation'
  and is_conversation_participant(nullif(split_part(realtime.topic(), ':', 2), '')::uuid)
);

create or replace function broadcast_new_message() returns trigger
security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id),
    'new_message',
    'conversation:' || new.conversation_id::text,
    true
  );
  return null;
end;
$$ language plpgsql;

create trigger broadcast_new_message_trigger
after insert on messages
for each row
execute function broadcast_new_message();

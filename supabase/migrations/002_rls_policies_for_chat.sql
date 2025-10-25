-- Enable RLS and add policies for conversations, chat_messages, and notifications.
-- Run in Supabase SQL Editor. Verify tables exist first (run your dev migration if needed).

BEGIN;

-- Ensure pgcrypto is present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies if present
DROP POLICY IF EXISTS conversations_select_participants ON public.conversations;
DROP POLICY IF EXISTS conversations_insert_participants ON public.conversations;
DROP POLICY IF EXISTS conversations_update_participants ON public.conversations;
DROP POLICY IF EXISTS conversations_delete_completed ON public.conversations;

DROP POLICY IF EXISTS messages_select_participants ON public.chat_messages;
DROP POLICY IF EXISTS messages_insert_sender_participant ON public.chat_messages;
DROP POLICY IF EXISTS messages_delete_completed_participants ON public.chat_messages;

DROP POLICY IF EXISTS notifications_select_recipient ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_by_participant ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_recipient ON public.notifications;

-- Conversations policies
CREATE POLICY conversations_select_participants
  ON public.conversations FOR SELECT
  USING (auth.uid() = donor_id OR auth.uid() = receiver_id);

CREATE POLICY conversations_insert_participants
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = donor_id OR auth.uid() = receiver_id);

CREATE POLICY conversations_update_participants
  ON public.conversations FOR UPDATE
  USING (auth.uid() = donor_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = donor_id OR auth.uid() = receiver_id);

CREATE POLICY conversations_delete_completed
  ON public.conversations FOR DELETE
  USING ((auth.uid() = donor_id OR auth.uid() = receiver_id) AND donor_complete AND receiver_complete);

-- Chat messages policies
CREATE POLICY messages_select_participants
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (auth.uid() = c.donor_id OR auth.uid() = c.receiver_id)
    )
  );

CREATE POLICY messages_insert_sender_participant
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (auth.uid() = c.donor_id OR auth.uid() = c.receiver_id)
    )
  );

CREATE POLICY messages_delete_completed_participants
  ON public.chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.donor_id OR auth.uid() = c.receiver_id)
        AND c.donor_complete AND c.receiver_complete
    )
  );

-- Notifications policies
CREATE POLICY notifications_select_recipient
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY notifications_insert_by_participant
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (auth.uid() = c.donor_id OR auth.uid() = c.receiver_id)
    )
  );

CREATE POLICY notifications_delete_recipient
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;

-- Keep this minimal dev SQL for local/testing. Run in Supabase SQL Editor to create tables.
-- Later: replace with RLS-enabled policies before production.

-- (Assumes you already have conversations and chat_messages created)
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop old tables and recreate minimal chat schema (dev)
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid,
  donor_id uuid,
  receiver_id uuid,
  donor_complete boolean DEFAULT false,
  receiver_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_donation_id ON public.conversations (donation_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages (conversation_id);

-- NEW: notifications table for unread/away notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,            -- recipient user id
  conversation_id uuid,             -- conversation related
  message_id uuid,                  -- optional reference to message
  preview text,                     -- short text preview
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id ON public.notifications (conversation_id);

COMMIT;

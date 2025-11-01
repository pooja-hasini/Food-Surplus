BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create notifications table if it does not already exist
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,            -- recipient user id
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid,                  -- optional reference to a specific chat message
  preview text,                     -- short text preview (used by client)
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id ON public.notifications (conversation_id);

COMMIT;

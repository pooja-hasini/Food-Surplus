-- Dev unblock: disable RLS and drop chat/notification policies so client inserts/selects work.
BEGIN;

-- Drop notification/conversation/message policies if present
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

-- Disable Row Level Security so anon/regular inserts/selects work in dev
ALTER TABLE IF EXISTS public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;

COMMIT;

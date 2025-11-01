import { supabase } from "@/lib/supabaseClient";

export async function markMessagesAsRead(conversationId: string, userId: string) {
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, read_by")
    .eq("conversation_id", conversationId);

  if (!messages) return;

  for (const msg of messages) {
    const readBy = msg.read_by || [];
    if (!readBy.includes(userId)) {
      await supabase
        .from("chat_messages")
        .update({ read_by: [...readBy, userId] })
        .eq("id", msg.id);
    }
  }
}

import { supabase } from "@/lib/supabaseClient"; // adjust path if yours is different

export async function getUnreadCount(userId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, read_by, sender_id");

  if (error) {
    console.error("Error fetching unread messages:", error);
    return 0;
  }

  // Count only messages NOT sent by this user and not read by this user
  const unreadCount = data.filter(
    (msg) => msg.sender_id !== userId && (!msg.read_by || !msg.read_by.includes(userId))
  ).length;

  return unreadCount;
}

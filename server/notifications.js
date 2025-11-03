const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

// ✅ Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Route: get unread counts
router.get("/unread-counts", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    // 🧠 Query: count unread notifications per conversation
    const { data, error } = await supabase
      .from("notifications")
      .select("conversation_id")
      .eq("user_id", userId)
      .eq("read", false);

    if (error) throw error;

    // 🧮 Group unread counts
    const counts = {};
    data.forEach((n) => {
      counts[n.conversation_id] = (counts[n.conversation_id] || 0) + 1;
    });

    return res.json({ counts });
  } catch (err) {
    console.error("Error fetching unread counts:", err);
    return res.status(500).json({ error: "server error" });
  }
});

module.exports = router;

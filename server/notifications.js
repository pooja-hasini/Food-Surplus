const express = require('express');
const router = express.Router();

/*
  GET /api/notifications/unread-counts?userId=<userId>&donationIds=1,2,3
  Response: { counts: { "<donationId>": <number>, ... } }
  Replace mock logic with real DB queries.
*/

router.get('/unread-counts', async (req, res) => {
  try {
    const userId = req.query.userId;
    const donationIdsParam = req.query.donationIds || '';
    const donationIds = donationIdsParam ? donationIdsParam.split(',') : [];

    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Replace this mock with DB query. Example (pseudo):
    // SELECT donation_id, COUNT(*) AS unread FROM messages
    // WHERE donation_id IN (...) AND recipient_id = ? AND is_read = false
    // GROUP BY donation_id

    // Mock implementation (demo)
    const counts = {};
    donationIds.forEach((id) => {
      counts[id] = Math.floor(Math.random() * 5); // demo random unread counts
    });

    return res.json({ counts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
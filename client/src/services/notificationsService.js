export async function getUnreadCounts({ userId, donationIds = [] }) {
  if (!userId) return { counts: {} };
  const params = new URLSearchParams();
  params.set('userId', userId);
  if (donationIds.length) params.set('donationIds', donationIds.join(','));
  const resp = await fetch(`/api/notifications/unread-counts?${params.toString()}`, {
    credentials: 'include',
  });
  if (!resp.ok) throw new Error('Failed to fetch unread counts');
  return resp.json(); // { counts: { donationId: number } }
}

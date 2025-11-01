import { useEffect, useState, useRef } from 'react';
import { getUnreadCounts } from '../services/notificationsService';

/*
  usage:
  const { counts, refresh } = useUnreadCounts(userId, donationIds, { pollIntervalMs: 15000 });
  counts is an object mapping donationId -> number
*/

export function useUnreadCounts(userId, donationIds = [], options = {}) {
  const { pollIntervalMs = 15000, enabled = true } = options;
  const [counts, setCounts] = useState({});
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchCounts = async () => {
    if (!enabled || !userId) return;
    try {
      const data = await getUnreadCounts({ userId, donationIds });
      if (mounted.current) setCounts(data.counts || {});
    } catch (e) {
      console.error('Unread counts fetch failed', e);
    }
  };

  useEffect(() => {
    fetchCounts();
    if (!enabled) return;
    const timer = setInterval(fetchCounts, pollIntervalMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, donationIds.join(','), pollIntervalMs, enabled]);

  return { counts, refresh: fetchCounts };
}

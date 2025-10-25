'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export default function NotificationListener() {
  const { toast } = useToast();
  const router = useRouter();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (!uid || !mounted) return;

        channelRef.current = supabase
          .channel(`public:notifications:user_id=eq.${uid}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
            (payload: any) => {
              const n = payload.new;
              toast({
                title: 'New message',
                description: n?.preview ?? 'New message received',
              });
              // Optional: navigate immediately when notification arrives:
              // if (n?.conversation_id) router.push(`/chat/${n.conversation_id}`);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Notification subscribe error', err);
      }
    })();

    return () => {
      mounted = false;
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch (e) { /* ignore */ }
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

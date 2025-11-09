'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check } from 'lucide-react';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const convId = typeof params.id === 'string' ? params.id : '';
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const returnToParam = searchParams?.get('returnTo') ?? null;

  const [userId, setUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingComplete, setUpdatingComplete] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const realtimeRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUserId(data?.user?.id ?? null);
      } catch (err) {
        console.error('Auth getUser error', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!convId || !userId) return;
    let channel: any = null;

    const load = async () => {
      setLoading(true);
      try {
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', convId)
          .limit(1)
          .maybeSingle();
        if (convErr || !conv) {
          toast({ title: 'Conversation not found', description: convErr?.message ?? 'Unable to load conversation.' });
          setConversation(null);
          setLoading(false);
          return;
        }
        setConversation(conv);

        const { data: msgs, error: msgErr } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        if (msgErr) {
          console.error('Messages load error:', msgErr);
          toast({ title: 'Messages load failed', description: msgErr.message });
        } else {
          setMessages(msgs ?? []);
        }

        // realtime subscription
        try {
          channel = supabase
            .channel(`public:chat_messages:conversation_id=eq.${convId}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` },
              (payload: any) => {
                setMessages(prev => {
                  if (prev.some(m => String(m.id) === String(payload.new.id))) return prev;
                  const filtered = prev.filter(
                    m => !(m.__temp && m.content === payload.new.content && String(m.sender_id) === String(payload.new.sender_id))
                  );
                  return [...filtered, payload.new];
                });
              }
            )
            .subscribe();
          realtimeRef.current = channel;
        } catch (e) {
          console.warn('Realtime subscription failed', e);
        }
      } catch (err: any) {
        console.error('Load error:', err);
        toast({ title: 'Load failed', description: err?.message ?? 'Unable to load chat.' });
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (realtimeRef.current) {
        try {
          supabase.removeChannel(realtimeRef.current);
        } catch (e) {}
        realtimeRef.current = null;
      }
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {}
      }
    };
  }, [convId, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const clearNotificationsForMe = async () => {
      if (!convId || !userId) return;
      try {
        await supabase.from('notifications').delete().eq('conversation_id', convId).eq('user_id', userId);
      } catch (e) {
        console.warn('Failed to clear notifications for conversation', e);
      }
    };
    clearNotificationsForMe();
  }, [convId, userId]);

  // ✅ Fixed sendMessage with recipientId guard
  const sendMessage = async () => {
    if (!text.trim() || !userId) {
      toast({ title: 'Not signed in', description: 'Please sign in to send messages.' });
      return;
    }
    if (sending) return;

    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      conversation_id: convId,
      sender_id: userId,
      content: text.trim(),
      created_at: new Date().toISOString(),
      __temp: true,
    };

    setMessages(prev => [...prev, tempMsg]);
    setText('');
    setSending(true);

    try {
      if (!convId) throw new Error('Invalid conversation id');

      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: convId,
          sender_id: userId,
          content: tempMsg.content,
        })
        .select()
        .single();

      if (error) {
        console.error('Insert error (full):', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast({ title: 'Send failed', description: error.message });
        return;
      }

      if (!inserted) {
        console.error('Insert returned no row');
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast({ title: 'Send failed', description: 'Insert returned no row.' });
        return;
      }

      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId);
        if (!withoutTemp.some(m => String(m.id) === String(inserted.id))) {
          return [...withoutTemp, inserted];
        }
        return withoutTemp;
      });

      // ✅ SAFETY CHECK added here
      (async () => {
        try {
          let recipientId: string | null = null;
          if (conversation?.donor_id && conversation?.receiver_id) {
            recipientId =
              String(conversation.donor_id) === String(userId)
                ? conversation.receiver_id
                : conversation.donor_id;
          } else {
            const { data: convRow } = await supabase
              .from('conversations')
              .select('donor_id, receiver_id')
              .eq('id', convId)
              .limit(1)
              .maybeSingle();
            if (convRow) {
              recipientId =
                String(convRow.donor_id) === String(userId)
                  ? convRow.receiver_id
                  : convRow.donor_id;
            }
          }

          if (!recipientId) {
            console.warn('⚠️ Notification skipped — recipientId is null');
            return;
          }

          // Prevent duplicate notifications: check if a very recent identical notification already exists
          try {
            const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('conversation_id', convId)
              .eq('user_id', recipientId)
              .eq('message', tempMsg.content)
              .gte('created_at', fiveSecondsAgo)
              .limit(1)
              .maybeSingle();

            if (!existing) {
              await supabase.from('notifications').insert({
                conversation_id: convId,
                user_id: recipientId,
                message: tempMsg.content,
                sender_id: userId,
                read: false,
                created_at: new Date().toISOString(),
              });
            }
          } catch (notifyErr) {
            console.warn('Failed to create notification', notifyErr);
          }
        } catch (notifyErr) {
          console.warn('Failed to create notification', notifyErr);
        }
      })();
    } catch (err: any) {
      console.error('Send error:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({ title: 'Send failed', description: err?.message ?? 'Error sending message.' });
    } finally {
      setSending(false);
    }
  };

  const toggleComplete = async (role: 'donor' | 'receiver') => {
    if (!conversation) return;
    setUpdatingComplete(true);
    try {
      const payload: any = {};
      if (role === 'donor') payload.donor_complete = !conversation.donor_complete;
      else payload.receiver_complete = !conversation.receiver_complete;

      const { data: updated, error } = await supabase
        .from('conversations')
        .update(payload)
        .eq('id', convId)
        .select()
        .single();

      if (error) {
        console.error('Complete update failed:', error);
        toast({ title: 'Update failed', description: error.message });
        return;
      }
      setConversation(updated);

      if (updated.donor_complete && updated.receiver_complete) {
        await supabase.from('chat_messages').delete().eq('conversation_id', convId);
        await supabase.from('conversations').delete().eq('id', convId);
        toast({ title: 'Chat completed', description: 'Conversation removed.' });
        router.push('/');
      }
    } catch (err: any) {
      console.error('Toggle complete error:', err);
      toast({ title: 'Update failed', description: err?.message ?? 'Unable to update.' });
    } finally {
      setUpdatingComplete(false);
    }
  };

  const renderMessages = () => {
    if (loading) return <div className="text-center text-sm">Loading messages...</div>;
    if (!messages || messages.length === 0)
      return <div className="text-center text-sm text-muted-foreground">No messages yet</div>;

    return messages.map(m => {
      const isMe = String(m.sender_id) === String(userId);
      return (
        <div
          key={m.id ?? String(Math.random())}
          className={`max-w-[80%] p-3 rounded-lg my-1 ${
            isMe ? 'ml-auto bg-emerald-100 text-emerald-900' : 'mr-auto bg-muted/20 text-muted-foreground'
          }`}
          style={{ wordBreak: 'break-word' }}
        >
          <div className="text-sm whitespace-pre-wrap">{m.content}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {new Date(m.created_at).toLocaleString()}
          </div>
        </div>
      );
    });
  };

  if (!convId) return <div className="container py-8">Invalid conversation.</div>;

  return (
    <div className="container py-8 max-w-3xl mx-auto">
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button aria-label="Back" variant="ghost" size="sm" onClick={() => {
              if (returnToParam) {
                try { router.push(decodeURIComponent(returnToParam)); return; } catch(e) { /* fallthrough */ }
              }
              router.back();
            }}>←</Button>
            <div>
              <h2 className="text-lg font-semibold">Chat</h2>
              <p className="text-sm text-muted-foreground">
                {conversation?.donation_id ? `Donation: ${conversation.donation_id}` : ''}
              </p>
            </div>
          </div>
          {/* Donor-side 'Mark Complete' button removed as requested */}
        </div>
      </Card>

      <Card className="p-4 mb-4 h-[60vh] flex flex-col">
        <div className="overflow-auto flex-1 space-y-3 mb-4">
          {renderMessages()}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="flex-1 rounded border p-2 resize-none"
            rows={2}
            placeholder="Write a message..."
          />
          <Button onClick={sendMessage} disabled={sending || !text.trim()}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}

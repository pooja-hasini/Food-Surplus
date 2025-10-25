// Keep this file. It implements chat UI, realtime subscription, optimistic sends,
// role detection and cleanup. Remove extra console.debug once stable.

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    if (!convId) return;
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
                // dedupe by id
                setMessages(prev => {
                  if (prev.some(m => String(m.id) === String(payload.new.id))) return prev;
                  // remove any optimistic temp that matches content + sender
                  const filtered = prev.filter(m => !(m.__temp && m.content === payload.new.content && String(m.sender_id) === String(payload.new.sender_id)));
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
        try { supabase.removeChannel(realtimeRef.current); } catch (e) { /* ignore */ }
        realtimeRef.current = null;
      }
      if (channel) {
        try { supabase.removeChannel(channel); } catch (e) { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // when user opens chat clear their notifications for this conversation
    const clearNotificationsForMe = async () => {
      if (!convId || !userId) return;
      try {
        await supabase
          .from('notifications')
          .delete()
          .eq('conversation_id', convId)
          .eq('user_id', userId);
      } catch (e) {
        console.warn('Failed to clear notifications for conversation', e);
      }
    };
    clearNotificationsForMe();
  }, [convId, userId]);

  // ...existing code...
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

    // optimistic
    setMessages(prev => [...prev, tempMsg]);
    setText('');
    setSending(true);

    try {
      if (!convId) throw new Error('Invalid conversation id');

      // attempt insert
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: convId,
          sender_id: userId,
          content: tempMsg.content,
        })
        .select()
        .single();

      // detailed logging for debugging RLS/permission errors
      if (error) {
        // show full error properties
        console.error('Insert error (full):', error, Object.getOwnPropertyNames(error));
        // remove optimistic message
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const full = JSON.stringify(error, Object.getOwnPropertyNames(error));
        toast({ title: 'Send failed', description: full || String(error) });
        return;
      }

      if (!inserted) {
        // no row returned — treat as failure
        console.error('Insert returned no row', { inserted, convId, userId });
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast({ title: 'Send failed', description: 'Insert returned no row from server.' });
        return;
      }

      // replace temp with inserted (if not already added via realtime)
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId);
        if (!withoutTemp.some(m => String(m.id) === String(inserted.id))) {
          return [...withoutTemp, inserted];
        }
        return withoutTemp;
      });

      // ...notifications code unchanged...
    } catch (err: any) {
      console.error('Send error:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({ title: 'Send failed', description: String(err?.message ?? err) });
    } finally {
      setSending(false);
    }
  };
 // ...existing code...

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
    if (!messages || messages.length === 0) return <div className="text-center text-sm text-muted-foreground">No messages yet</div>;

    return messages.map(m => {
      const isMe = String(m.sender_id) === String(userId);
      return (
        <div key={m.id ?? String(Math.random())} className={`max-w-[80%] p-3 rounded-lg my-1 ${isMe ? 'ml-auto bg-emerald-100 text-emerald-900' : 'mr-auto bg-muted/20 text-muted-foreground'}`} style={{ wordBreak: 'break-word' }}>
          <div className="text-sm whitespace-pre-wrap">{m.content}</div>
          <div className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString()}</div>
        </div>
      );
    });
  };

  if (!convId) return <div className="container py-8">Invalid conversation.</div>;

  return (
    <div className="container py-8 max-w-3xl mx-auto">
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Chat</h2>
            <p className="text-sm text-muted-foreground">{conversation?.donation_id ? `Donation: ${conversation.donation_id}` : ''}</p>
          </div>
          <div>
            {/* only show relevant complete button if role known */}
            {userId && (userId === conversation?.donor_id) && (
              <Button size="sm" variant={conversation?.donor_complete ? 'secondary' : 'outline'} onClick={() => toggleComplete('donor')} disabled={updatingComplete}>
                <Check className="mr-2 h-4 w-4" /> {conversation?.donor_complete ? 'Undo Complete' : 'Mark Complete'}
              </Button>
            )}
            {userId && (userId === conversation?.receiver_id) && (
              <Button size="sm" variant={conversation?.receiver_complete ? 'secondary' : 'outline'} onClick={() => toggleComplete('receiver')} disabled={updatingComplete}>
                <Check className="mr-2 h-4 w-4" /> {conversation?.receiver_complete ? 'Undo Complete' : 'Mark Complete'}
              </Button>
            )}
          </div>
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
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
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

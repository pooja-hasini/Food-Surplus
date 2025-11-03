import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const listingId = body?.listingId;
    if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 });

    // find any conversation for this listing
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('donation_id', listingId)
      .limit(1)
      .maybeSingle();

    if (convErr) console.debug('close-listing: conv find error', convErr);

    if (conv && conv.id) {
      // mark conversation closed (both parties) so it persists as closed and cannot be reopened
      try {
        await supabase.from('conversations').update({ donor_complete: true, receiver_complete: true }).eq('id', conv.id);
      } catch (e) {
        console.warn('close-listing: failed updating conversation to completed', e);
      }
    } else {
      // no conversation exists: create a sentinel conversation marked completed so opening chat is blocked
      try {
        // try to derive donor id from the listing row
        const { data: listingRow } = await supabase.from('food_listings').select('user_id, donor_id, posted_by').eq('id', listingId).maybeSingle();
        const donorId = listingRow?.user_id || listingRow?.donor_id || listingRow?.posted_by || null;
        await supabase.from('conversations').insert({ donation_id: listingId, donor_id: donorId, receiver_id: null, donor_complete: true, receiver_complete: true });
      } catch (e) {
        console.warn('close-listing: failed to insert sentinel conversation', e);
      }
    }

    // Try to mark the listing as completed. If the column doesn't exist this will fail silently.
    try {
      await supabase.from('food_listings').update({ completed: true }).eq('id', listingId);
    } catch (e) {
      console.debug('close-listing: failed to set listing.completed (maybe column missing)', e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('close-listing error', e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

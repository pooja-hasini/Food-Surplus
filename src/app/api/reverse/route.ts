import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    if (!lat || !lon) return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });

    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': 'ReFeed-App/1.0 (+https://example.com)' } }
    );
    if (!res.ok) return NextResponse.json({ error: 'geocode failed' }, { status: 502 });
    const json = await res.json();
    return NextResponse.json({ display_name: json.display_name ?? null, raw: json });
  } catch (err) {
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

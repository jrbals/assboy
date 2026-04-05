import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';
import { sanitizeDomainName, sanitizeTld, sanitizeDescription, sanitizePrice } from '@/lib/validate';

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('domains')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, tld, price, description } = body;

  const domainName = sanitizeDomainName(name);
  if (!domainName) return NextResponse.json({ error: 'Invalid domain name' }, { status: 400 });

  const domainTld = sanitizeTld(tld);
  if (!domainTld) return NextResponse.json({ error: 'Invalid TLD' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('domains')
    .insert({
      name: domainName,
      tld: domainTld,
      base_name: domainName,
      price: Math.round(sanitizePrice(price) * 100),
      description: sanitizeDescription(description),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const safeUpdates: Record<string, unknown> = {};
  if (updates.price !== undefined) safeUpdates.price = Math.round(sanitizePrice(updates.price) * 100);
  if (updates.description !== undefined) safeUpdates.description = sanitizeDescription(updates.description);
  if (updates.status !== undefined) {
    if (!['available', 'pending', 'sold'].includes(updates.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    safeUpdates.status = updates.status;
  }

  const { data, error } = await supabaseAdmin
    .from('domains')
    .update(safeUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const { error } = await supabaseAdmin.from('domains').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';
import { priceDomain } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domainId, domainName } = await request.json();

  try {
    const { price, reasoning } = await priceDomain(domainName);

    const { error } = await supabaseAdmin
      .from('domains')
      .update({ price: price * 100, description: reasoning })
      .eq('id', domainId);

    if (error) throw error;

    return NextResponse.json({ price, reasoning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pricing failed' },
      { status: 500 }
    );
  }
}

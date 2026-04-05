import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';
import { priceDomain } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: zeroDomains, error } = await supabaseAdmin
    .from('domains')
    .select('id, name, tld')
    .eq('price', 0);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!zeroDomains?.length) return NextResponse.json({ priced: 0, message: 'No $0 domains found' });

  let pricedCount = 0;
  for (const domain of zeroDomains) {
    try {
      const fullName = `${domain.name}${domain.tld}`;
      const { price, reasoning } = await priceDomain(fullName);

      await supabaseAdmin
        .from('domains')
        .update({ price: price * 100, description: reasoning })
        .eq('id', domain.id);

      pricedCount++;
    } catch (e) {
      console.error(`Pricing failed for ${domain.name}${domain.tld}:`, e);
    }
  }

  return NextResponse.json({ priced: pricedCount, total: zeroDomains.length });
}

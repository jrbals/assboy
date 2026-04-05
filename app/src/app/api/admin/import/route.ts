import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';
import { generateLogo } from '@/lib/grok';
import { priceDomain } from '@/lib/pricing';
import { supabase as supabaseConfig } from '@/lib/config';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domains } = await request.json();

  const records = domains
    .filter((d: { name: string }) => d.name.includes('.'))
    .map((d: { name: string; price?: number; description?: string }) => {
      const parts = d.name.split('.');
      const tld = '.' + parts.slice(1).join('.');
      const name = parts[0];
      return {
        name,
        tld,
        base_name: name,
        price: Math.round((d.price || 0) * 100),
        hasUserPrice: (d.price || 0) > 0,
        description: d.description || '',
        status: 'available',
      };
    });

  // Dedupe against existing domains
  const { data: existing } = await supabaseAdmin
    .from('domains')
    .select('name, tld');

  const existingSet = new Set((existing || []).map(d => `${d.name}${d.tld}`));
  const unique = records.filter((r: { name: string; tld: string }) => !existingSet.has(`${r.name}${r.tld}`));
  const duplicateCount = records.length - unique.length;

  if (unique.length === 0) {
    return NextResponse.json({ imported: 0, duplicates: duplicateCount, priced: 0, logos: 0, domains: [] });
  }

  // Step 1: AI-price domains without a user-provided price (3 at a time)
  const needsPricing = unique.filter((r: { hasUserPrice: boolean }) => !r.hasUserPrice);
  let pricedCount = 0;
  for (let i = 0; i < needsPricing.length; i += 3) {
    const batch = needsPricing.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async (record: { name: string; tld: string; price: number; description: string }) => {
        const fullName = `${record.name}${record.tld}`;
        const { price, reasoning } = await priceDomain(fullName);
        record.price = price * 100;
        if (!record.description) record.description = reasoning;
        pricedCount++;
      })
    );
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        console.error(`Pricing failed for ${batch[idx].name}${batch[idx].tld}:`, r.reason);
        batch[idx].price = 100000;
      }
    });
  }

  // Remove helper field before insert
  const insertRecords = unique.map(({ hasUserPrice, ...rest }: { hasUserPrice: boolean; [key: string]: unknown }) => rest);

  const { data, error } = await supabaseAdmin
    .from('domains')
    .insert(insertRecords)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Step 2: Generate logos — one per unique base_name
  // Check if any existing domain with same base_name already has a logo
  const { data: existingLogos } = await supabaseAdmin
    .from('domains')
    .select('base_name, logo_url')
    .not('logo_url', 'is', null);

  const existingLogoMap = new Map<string, string>();
  for (const d of (existingLogos || [])) {
    if (d.base_name && d.logo_url) existingLogoMap.set(d.base_name, d.logo_url);
  }

  // Group inserted domains by base_name
  const baseGroups = new Map<string, typeof data>();
  for (const domain of (data || [])) {
    const base = domain.base_name || domain.name;
    if (!baseGroups.has(base)) baseGroups.set(base, []);
    baseGroups.get(base)!.push(domain);
  }

  let logoCount = 0;
  for (const [baseName, group] of baseGroups) {
    // Reuse existing logo if another TLD already has one
    const existingUrl = existingLogoMap.get(baseName);
    if (existingUrl) {
      const ids = group.map((d: { id: string }) => d.id);
      await supabaseAdmin
        .from('domains')
        .update({ logo_url: existingUrl })
        .in('id', ids);
      logoCount++;
      continue;
    }

    // Generate one logo for this base name
    try {
      const imageBuffer = await generateLogo(baseName);
      const fileName = `${baseName}.png`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(supabaseConfig.storageBucket)
        .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true });

      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from(supabaseConfig.storageBucket)
          .getPublicUrl(fileName);

        const logoUrl = `${publicUrl}?v=${Date.now()}`;

        // Apply same logo to all TLDs of this base name
        const ids = group.map((d: { id: string }) => d.id);
        await supabaseAdmin
          .from('domains')
          .update({ logo_url: logoUrl })
          .in('id', ids);

        logoCount++;
      }
    } catch (e) {
      console.error(`Logo gen failed for ${baseName}:`, e);
    }
  }

  return NextResponse.json({
    imported: data?.length || 0,
    duplicates: duplicateCount,
    priced: pricedCount,
    logos: logoCount,
    domains: data,
  });
}

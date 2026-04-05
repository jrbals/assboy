import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateLogo } from '@/lib/grok';
import { isAdmin } from '@/lib/auth';
import { supabase as supabaseConfig } from '@/lib/config';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domainId, domainName, customPrompt } = await request.json();

  try {
    const imageBuffer = await generateLogo(domainName, customPrompt);
    const fileName = `${domainName.replace(/\./g, '-')}.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(supabaseConfig.storageBucket)
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(supabaseConfig.storageBucket)
      .getPublicUrl(fileName);

    // Add cache-buster so browser shows the new image
    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabaseAdmin
      .from('domains')
      .update({ logo_url: cacheBustedUrl })
      .eq('id', domainId);

    if (updateError) throw updateError;

    return NextResponse.json({ logo_url: cacheBustedUrl });
  } catch (error) {
    console.error('Logo generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate logo' },
      { status: 500 }
    );
  }
}

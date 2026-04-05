import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';
import { stripeConfig, site } from '@/lib/config';

export async function POST(request: NextRequest) {
  const { domainId } = await request.json();

  if (!domainId || typeof domainId !== 'string') {
    return NextResponse.json({ error: 'Invalid domain ID' }, { status: 400 });
  }

  // Atomic: lock the domain by updating status, only if currently available
  const { data: domain, error } = await supabaseAdmin
    .from('domains')
    .update({ status: 'pending' })
    .eq('id', domainId)
    .eq('status', 'available')
    .select('*')
    .single();

  if (error || !domain) {
    return NextResponse.json({ error: 'Domain not available' }, { status: 409 });
  }

  const fullName = `${domain.name}${domain.tld}`;
  const origin = request.headers.get('origin') || `https://${site.domain}`;

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: stripeConfig.currency,
            product_data: {
              name: `Domain: ${fullName}`,
              description: domain.description || `Purchase the domain ${fullName}`,
              images: domain.logo_url ? [domain.logo_url.split('?')[0]] : undefined,
            },
            unit_amount: domain.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#domains`,
      custom_text: {
        submit: { message: `You're purchasing the domain ${fullName}. Transfer instructions will be sent to your email within 24 hours.` },
      },
      metadata: {
        domain_id: domainId,
        domain_name: fullName,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Release domain back if Stripe fails
    await supabaseAdmin
      .from('domains')
      .update({ status: 'available' })
      .eq('id', domainId);

    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Payment setup failed' }, { status: 500 });
  }
}

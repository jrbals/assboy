import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { stripeConfig } from '@/lib/config';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    if (stripeConfig.webhookSecret) {
      event = stripe.webhooks.constructEvent(body, sig, stripeConfig.webhookSecret);
    } else {
      // In development without webhook secret, still parse but log warning
      console.warn('STRIPE_WEBHOOK_SECRET not set — accepting unverified webhook in dev only');
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const domainId = session.metadata?.domain_id;
    const domainName = session.metadata?.domain_name;

    if (domainId) {
      await supabaseAdmin.from('orders').insert({
        domain_id: domainId,
        buyer_email: session.customer_details?.email || session.customer_email || '',
        buyer_name: session.customer_details?.name || '',
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent as string,
        amount: session.amount_total || 0,
        status: 'paid',
      });

      await supabaseAdmin
        .from('domains')
        .update({ status: 'pending' })
        .eq('id', domainId);

      console.log(`Payment received for ${domainName}`);
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const domainId = session.metadata?.domain_id;

    if (domainId) {
      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('domain_id', domainId)
        .eq('status', 'paid')
        .single();

      if (!existingOrder) {
        await supabaseAdmin
          .from('domains')
          .update({ status: 'available' })
          .eq('id', domainId);
      }
    }
  }

  return NextResponse.json({ received: true });
}

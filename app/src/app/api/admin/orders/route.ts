import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, domains(*)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, status, transfer_instructions, auth_code } = await request.json();

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .update({ status, transfer_instructions })
    .eq('id', id)
    .select('*, domains(*)')
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  // If transfer initiated, update domain auth code
  if (auth_code && order.domain_id) {
    await supabaseAdmin
      .from('domains')
      .update({ auth_code, status: 'pending' })
      .eq('id', order.domain_id);
  }

  if (status === 'completed') {
    await supabaseAdmin
      .from('domains')
      .update({ status: 'sold' })
      .eq('id', order.domain_id);
  }

  return NextResponse.json(order);
}

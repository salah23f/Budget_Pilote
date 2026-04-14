import { NextRequest, NextResponse } from 'next/server';

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/group-trips/[id]/expenses — Add an expense
 */
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const db = await getSupabase();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const { description, amount, paidBy } = await req.json();
    const groupId = context.params.id;

    if (!description?.trim() || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Description and positive amount required' }, { status: 400 });
    }

    const { data: expense, error } = await db
      .from('group_expenses')
      .insert({
        group_id: groupId,
        description: description.trim(),
        amount: Number(amount),
        paid_by: paidBy || 'Unknown',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[group-trips] Expense added: ${description} $${amount} by ${paidBy}`);

    return NextResponse.json({ success: true, expense });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

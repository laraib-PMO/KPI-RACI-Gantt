import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

// GET standups (last 14 days by default)
export async function GET() {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const dateStr = twoWeeksAgo.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('standups')
      .select('*')
      .gte('standup_date', dateStr)
      .order('standup_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST new standup entry
export async function POST(req) {
  try {
    const body = await req.json();
    const entry = {
      person: body.person || 'Unknown',
      completed: body.completed || '',
      tomorrow: body.tomorrow || '',
      blockers: body.blockers || 'None',
      standup_date: body.standup_date || new Date().toISOString().split('T')[0],
      source: body.source || 'manual',
    };
    const { data, error } = await supabase.from('standups').insert(entry).select();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data[0]);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// DELETE a standup entry
export async function DELETE(req) {
  try {
    const { id } = await req.json();
    const { error } = await supabase.from('standups').delete().eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

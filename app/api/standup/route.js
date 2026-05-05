import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

// GET standups (last 14 days by default)
export async function GET() {
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
}

// POST new standup entry
export async function POST(req) {
  const body = await req.json();

  // Single entry from dashboard or webhook
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
}

// DELETE a standup entry
export async function DELETE(req) {
  const { id } = await req.json();
  const { error } = await supabase.from('standups').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

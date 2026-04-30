import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

// GET all tasks
export async function GET() {
  const { data, error } = await supabase.from('tasks').select('*').order('id');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// POST create or update a task
export async function POST(req) {
  const body = await req.json();
  
  if (body.id) {
    // Update existing task
    const { data, error } = await supabase
      .from('tasks')
      .update({
        name: body.name, dept: body.dept, owner: body.owner,
        start_date: body.start_date, end_date: body.end_date,
        status: body.status, priority: body.priority, risk: body.risk,
        deps: body.deps || [], section: body.section,
      })
      .eq('id', body.id)
      .select();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data[0]);
  } else {
    // Create new task
    const { data, error } = await supabase.from('tasks').insert(body).select();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data[0]);
  }
}

// DELETE a task
export async function DELETE(req) {
  const { id } = await req.json();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

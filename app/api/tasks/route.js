import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

// GET all tasks
export async function GET() {
  try {
    const { data, error } = await supabase.from('tasks').select('*').order('id');
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST create or update a task
export async function POST(req) {
  try {
    const body = await req.json();
    if (body.id) {
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
      const { data, error } = await supabase.from('tasks').insert(body).select();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(data[0]);
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// DELETE a task
export async function DELETE(req) {
  try {
    const { id } = await req.json();
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

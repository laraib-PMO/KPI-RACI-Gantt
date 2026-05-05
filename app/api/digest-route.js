import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);

async function getLinearDoneToday() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ issues(first:100,filter:{completedAt:{gte:"${today}T00:00:00Z"}}){nodes{id title description state{name}assignee{name}completedAt priority comments{nodes{body user{name}}}}}}` })
    });
    const data = await res.json();
    return (data?.data?.issues?.nodes||[]).map(i=>({source:'Linear',id:i.id,title:i.title,description:i.description||'',assignee:i.assignee?.name||'Unassigned',comments:(i.comments?.nodes||[]).map(c=>c.body).join(' | ')}));
  } catch(e){return[];}
}

async function getLinearAllActive() {
  const key = process.env.LINEAR_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST', headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{issues(first:100,filter:{state:{type:{nin:["canceled","backlog"]}}}){nodes{id title state{name type}assignee{name}dueDate startedAt priority}}}` })
    });
    const data = await res.json();
    return data?.data?.issues?.nodes||[];
  } catch(e){return[];}
}

async function getAsanaDoneToday() {
  const token = process.env.ASANA_TOKEN;
  if (!token) return [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`https://app.asana.com/api/1.0/tasks?opt_fields=name,assignee.name,completed,completed_at,notes,due_on&completed_since=${today}T00:00:00Z&limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return (data?.data||[]).filter(t=>t.completed).map(t=>({source:'Asana',id:t.gid,title:t.name,description:t.notes||'',assignee:t.assignee?.name||'Unassigned',comments:''}));
  } catch(e){return[];}
}

async function summarizeWithAI(personTasks) {
  const taskList = personTasks.map(t=>`- ${t.title}: ${t.description?t.description.slice(0,200):'No details'}${t.comments?' | Notes: '+t.comments.slice(0,200):''}`).join('\n');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY||'','anthropic-version':'2023-06-01'},
      body: JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:300,messages:[{role:'user',content:`Summarize this person's completed work today in 2-3 concise sentences. Focus on deliverables.\n\nTasks:\n${taskList}`}]})
    });
    const data = await res.json();
    return data?.content?.[0]?.text||taskList;
  } catch(e){return personTasks.map(t=>`Completed: ${t.title}`).join('. ');}
}

async function postToSlack(message) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:message})}).catch(()=>{});
}

export async function POST() {
  const today = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});

  const [linearDone,asanaDone,linearActive] = await Promise.all([getLinearDoneToday(),getAsanaDoneToday(),getLinearAllActive()]);
  const allDone = [...linearDone,...asanaDone];

  const byPerson = {};
  allDone.forEach(t=>{if(!byPerson[t.assignee])byPerson[t.assignee]=[];byPerson[t.assignee].push(t)});

  const activeCounts = {};
  linearActive.forEach(i=>{const n=i.assignee?.name||'Unassigned';if(!activeCounts[n])activeCounts[n]={inProgress:0,overdue:0,total:0};activeCounts[n].total++;if(i.state?.type==='started')activeCounts[n].inProgress++;if(i.dueDate&&i.dueDate<today&&i.state?.type!=='completed')activeCounts[n].overdue++});

  const summaries = [];
  for (const [person,tasks] of Object.entries(byPerson)) {
    const summary = await summarizeWithAI(tasks);
    const active = activeCounts[person]||{inProgress:0,overdue:0,total:0};
    await supabase.from('standups').insert({person,completed:summary,tomorrow:`${active.inProgress} in progress, ${active.total} total`,blockers:active.overdue>0?`${active.overdue} overdue`:'None',standup_date:today,source:'auto-digest'});
    summaries.push({person,taskCount:tasks.length,summary,active});
  }

  let slackMsg = `PMO Daily Digest — ${dayName}\n\n`;
  if (summaries.length===0) {slackMsg+='No tickets completed today.\n';}
  else {for(const s of summaries){slackMsg+=`*${s.person}* (${s.taskCount} done)\n${s.summary}\n${s.active.overdue>0?'⚠️ '+s.active.overdue+' overdue\n':''}\n`}}
  slackMsg+=`Total: ${allDone.length} completed | ${linearActive.length} active in Linear\nDashboard: https://attimo-ops.vercel.app`;
  await postToSlack(slackMsg);

  // Sync Linear active tasks to dashboard
  for (const issue of linearActive) {
    const{data:existing}=await supabase.from('tasks').select('id').eq('external_id',issue.id).eq('source','linear');
    if(existing&&existing.length>0){let st='To Do';if(issue.state?.type==='started')st='Doing';if(issue.state?.type==='completed')st='Done';await supabase.from('tasks').update({status:st,name:issue.title}).eq('id',existing[0].id)}
  }

  return Response.json({timestamp:new Date().toISOString(),completed:allDone.length,summaries:summaries.length,activeLinear:linearActive.length,message:'Digest complete'});
}

export async function GET(){return POST()}

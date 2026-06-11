// ═══════════════════════════════════════════════════════════════════════════
// /api/notion-sync — Pulls the Attimo Knowledge Hub (Notion) into the registry
//
// Upserts every page: title, doc type, status, last editor, last edited, link.
// Dedup on (source='notion', source_id=page id) — safe to run repeatedly.
//
// Requires in Vercel:
//   NOTION_API_KEY — internal integration secret
//                    (notion.so/profile/integrations > New integration,
//                     then share the Knowledge Hub page with the integration)
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Attimo Knowledge Hub database (override with env if it ever moves)
const NOTION_DB_ID = process.env.NOTION_KNOWLEDGE_DB_ID || '0f07d424bc2882f88f5f812612d9fc7c';
const NOTION_VERSION = '2022-06-28';

function extract(page) {
  const p = page.properties || {};
  const title = (p['Page Name']?.title || []).map(t => t.plain_text).join('') || 'Untitled';
  const docType = p['Document Type']?.select?.name || 'Information';
  const status = p['Status']?.status?.name || 'Draft';
  const editor = p['Last Edit by']?.last_edited_by?.name || '';
  const lastEdited = p['Last Edited Time']?.last_edited_time || page.last_edited_time || null;
  return { title, docType, status, editor, lastEdited };
}

export async function POST() { return sync(); }
export async function GET() { return sync(); }

async function sync() {
  try {
    const key = process.env.NOTION_API_KEY;
    if (!key) {
      return Response.json({
        ok: false, synced: 0,
        error: 'NOTION_API_KEY not set. Create an internal integration at notion.so/profile/integrations, share the Knowledge Hub page with it, add the secret to Vercel.',
      });
    }

    // Paginate through the database
    const pages = [];
    let cursor = undefined;
    let guard = 0;
    do {
      const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
      });
      const data = await res.json();
      if (data.object === 'error') {
        const hint = data.code === 'object_not_found'
          ? 'Database not found — make sure the Knowledge Hub page is SHARED with your integration (page > ... > Connections > add integration).'
          : data.message;
        return Response.json({ ok: false, synced: 0, error: hint });
      }
      pages.push(...(data.results || []));
      cursor = data.has_more ? data.next_cursor : undefined;
      guard++;
    } while (cursor && guard < 20);

    // Upsert into the registry
    let synced = 0;
    const errors = [];
    for (const page of pages) {
      const { title, docType, status, editor, lastEdited } = extract(page);
      const row = {
        title,
        url: page.url || `https://www.notion.so/${page.id.replace(/-/g, '')}`,
        doc_type: docType,
        file_kind: 'notion',
        status,
        owner_name: editor || null,
        source: 'notion',
        source_id: page.id,
        last_edited: lastEdited,
      };
      const { error } = await supabase
        .from('knowledge_docs')
        .upsert(row, { onConflict: 'source,source_id' });
      if (error) errors.push(`${title}: ${error.message}`);
      else synced++;
    }

    // Remove registry rows for Notion pages that were deleted/archived
    const liveIds = pages.map(p => p.id);
    if (liveIds.length > 0) {
      await supabase
        .from('knowledge_docs')
        .delete()
        .eq('source', 'notion')
        .not('source_id', 'in', `(${liveIds.map(id => `"${id}"`).join(',')})`);
    }

    return Response.json({ ok: true, synced, total_in_notion: pages.length, errors: errors.slice(0, 5) });
  } catch (err) {
    console.error('[notion-sync] Error:', err);
    return Response.json({ ok: false, synced: 0, error: 'Internal error: ' + err.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/drive-sync — Walks the Google Drive folder tree into the registry
//
// For every folder in drive_folders that has a folder_url:
//   - Lists files: name, link, last modified time, who modified it
//   - Discovers subfolders (1 level deep) and adds them to drive_folders
//   - Upserts files into knowledge_docs (source='drive', dedup on file id)
//
// Setup (no admin needed): share each Drive folder with the service account
// email as Viewer. Reuses GOOGLE_CALENDAR_KEY (same service account).
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MIME_KIND = {
  'application/vnd.google-apps.document': 'gdoc',
  'application/vnd.google-apps.spreadsheet': 'gsheet',
  'application/vnd.google-apps.presentation': 'gslides',
  'application/pdf': 'pdf',
};

async function getDriveToken() {
  const b64 = process.env.GOOGLE_CALENDAR_KEY;
  if (!b64) return null;
  try {
    const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600,
    })).toString('base64url');
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claims}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claims}.${signature}`,
    });
    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('[drive-sync] Auth failed:', e.message);
    return null;
  }
}

function extractFolderId(url) {
  if (!url) return null;
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function listChildren(token, folderId) {
  const files = [];
  let pageToken = '';
  let guard = 0;
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,lastModifyingUser(displayName))');
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
    guard++;
  } while (pageToken && guard < 10);
  return files;
}

async function upsertFile(file, folderRowId, dept) {
  const row = {
    title: file.name,
    url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    folder_id: folderRowId,
    dept: dept || null,
    file_kind: MIME_KIND[file.mimeType] || 'file',
    source: 'drive',
    source_id: file.id,
    last_edited: file.modifiedTime || null,
    owner_name: file.lastModifyingUser?.displayName || null,
    status: 'Accepted', // Drive files are working docs; no review workflow there
    doc_type: 'Information',
  };
  const { error } = await supabase.from('knowledge_docs').upsert(row, { onConflict: 'source,source_id' });
  return error ? error.message : null;
}

export async function POST() { return sync(); }
export async function GET() { return sync(); }

async function sync() {
  try {
    const token = await getDriveToken();
    if (!token) {
      return Response.json({
        ok: false, synced: 0,
        error: 'GOOGLE_CALENDAR_KEY not set or invalid — Drive sync needs the service account (Part A of the calendar setup guide). Then share each Drive folder with the service account email as Viewer.',
      });
    }

    const { data: folders, error: fErr } = await supabase.from('drive_folders').select('*');
    if (fErr) return Response.json({ ok: false, error: fErr.message }, { status: 500 });

    let synced = 0;
    let subfoldersAdded = 0;
    const skipped = [];
    const failed = [];

    // Walk only top-level rows that have a URL; subfolder rows discovered here get walked too
    const queue = folders
      .filter(f => extractFolderId(f.folder_url))
      .map(f => ({ row: f, depth: 0 }));

    const seen = new Set();

    while (queue.length > 0) {
      const { row, depth } = queue.shift();
      const folderId = extractFolderId(row.folder_url);
      if (!folderId || seen.has(folderId)) continue;
      seen.add(folderId);

      let children;
      try {
        children = await listChildren(token, folderId);
      } catch (e) {
        failed.push({ folder: row.folder_name, error: e.message.includes('File not found') ? 'Not shared with the service account — share as Viewer' : e.message });
        continue;
      }

      for (const child of children) {
        if (child.mimeType === 'application/vnd.google-apps.folder') {
          if (depth >= 2) continue; // depth cap
          // Upsert subfolder into drive_folders
          const { data: existing } = await supabase
            .from('drive_folders')
            .select('id, folder_url')
            .eq('folder_url', child.webViewLink)
            .maybeSingle();
          let subRow = existing;
          if (!existing) {
            const { data: inserted } = await supabase
              .from('drive_folders')
              .insert({
                dept: row.dept,
                folder_name: child.name,
                folder_url: child.webViewLink,
                description: '',
                owner_email: row.owner_email,
                parent_id: row.id,
                sort_order: 99,
              })
              .select()
              .single();
            subRow = inserted;
            if (inserted) subfoldersAdded++;
          }
          if (subRow) queue.push({ row: subRow, depth: depth + 1 });
        } else {
          const err = await upsertFile(child, row.id, row.dept);
          if (err) failed.push({ file: child.name, error: err });
          else synced++;
        }
      }
    }

    // Folders with no URL configured
    folders.filter(f => !extractFolderId(f.folder_url)).forEach(f => skipped.push(f.folder_name));

    return Response.json({
      ok: true,
      synced_files: synced,
      subfolders_discovered: subfoldersAdded,
      folders_without_url: skipped,
      failed: failed.slice(0, 8),
      note: skipped.length > 0 ? 'Folders without a Drive URL were skipped — set folder_url in the Documents tab.' : undefined,
    });
  } catch (err) {
    console.error('[drive-sync] Error:', err);
    return Response.json({ ok: false, error: 'Internal error: ' + err.message }, { status: 500 });
  }
}

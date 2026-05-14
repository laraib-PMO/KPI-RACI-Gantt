// ─── Meeting Slot Finder — Google Calendar Free/Busy ─────────────────────────
// Queries Google Calendar API for selected attendees' free/busy data
// Returns available slots over the next 5 working days
//
// SETUP REQUIRED:
// 1. Google Cloud → Enable "Google Calendar API"
// 2. Create Service Account → download JSON key
// 3. Each team member shares their Google Calendar with the service account email
// 4. Add env var: GOOGLE_CALENDAR_KEY = base64-encoded service account JSON

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY
);

async function getGoogleAccessToken() {
  const keyB64 = process.env.GOOGLE_CALENDAR_KEY;
  if (!keyB64) return null;

  try {
    const key = JSON.parse(Buffer.from(keyB64, 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    
    // Build JWT header + claims
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    })).toString('base64url');

    // Sign with private key
    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(header + '.' + claims);
    const signature = sign.sign(key.private_key, 'base64url');
    const jwt = header + '.' + claims + '.' + signature;

    // Exchange for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const tokenData = await tokenRes.json();
    return tokenData.access_token || null;
  } catch (e) {
    console.error('Google auth error:', e);
    return null;
  }
}

export async function POST(req) {
  try {
    const { emails, days = 5 } = await req.json();
    if (!emails || !emails.length) return Response.json({ error: 'No emails provided', slots: [] });

    // Get user timezone + working hours from DB
    const { data: users } = await supabase.from('user_roles').select('*').in('email', emails);
    if (!users || !users.length) return Response.json({ error: 'No matching users', slots: [] });

    const token = await getGoogleAccessToken();
    
    // Calculate time range: next N working days
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days + 2); // buffer for weekends
    const timeMax = endDate.toISOString();

    let busyData = {};

    if (token) {
      // Layer 2: Real Google Calendar free/busy
      try {
        const fbRes = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: emails.map(e => ({ id: e }))
          })
        });
        const fbData = await fbRes.json();
        if (fbData.calendars) {
          for (const [email, cal] of Object.entries(fbData.calendars)) {
            busyData[email] = (cal.busy || []).map(b => ({
              start: new Date(b.start).getTime(),
              end: new Date(b.end).getTime()
            }));
          }
        }
      } catch (e) {
        console.error('Google Calendar API error:', e);
        // Fall through to Layer 1
      }
    }

    // Build slots grid: each working day × each hour
    const slots = [];
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let daysAdded = 0;

    while (daysAdded < days) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // skip weekends
        const dateStr = currentDate.toISOString().split('T')[0];
        const daySlots = [];

        for (let h = 7; h <= 20; h++) { // 7am to 8pm range
          const slotStart = new Date(currentDate);
          slotStart.setHours(h, 0, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setHours(h + 1);
          const slotStartMs = slotStart.getTime();
          const slotEndMs = slotEnd.getTime();

          const attendeeStatus = users.map(u => {
            const tz = u.timezone || 'Europe/Istanbul';
            const ws = parseInt((u.work_start || '09:00').split(':')[0]);
            const we = parseInt((u.work_end || '18:00').split(':')[0]);

            // Check if this hour falls in their working hours (convert to their local time)
            let localH;
            try {
              localH = parseInt(slotStart.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }));
            } catch {
              localH = h;
            }
            const inHours = localH >= ws && localH < we;

            // Check if busy from Google Calendar
            const busy = (busyData[u.email] || []).some(b => b.start < slotEndMs && b.end > slotStartMs);

            // Check work pattern (is today a working day for this person?)
            const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const pattern = u.work_pattern || {};
            const dayStatus = pattern[dayNames[dayOfWeek]];
            const isWorkingDay = dayStatus && dayStatus !== 'off';

            return {
              name: u.name,
              email: u.email,
              available: inHours && !busy && isWorkingDay,
              inHours,
              busy,
              isWorkingDay
            };
          });

          const allAvailable = attendeeStatus.every(a => a.available);
          const someAvailable = attendeeStatus.some(a => a.available);

          daySlots.push({
            hour: h,
            time: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`,
            attendees: attendeeStatus,
            allAvailable,
            someAvailable,
            availableCount: attendeeStatus.filter(a => a.available).length
          });
        }

        slots.push({
          date: dateStr,
          dayName: currentDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          slots: daySlots
        });
        daysAdded++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return Response.json({
      slots,
      attendees: users.map(u => ({ name: u.name, email: u.email, timezone: u.timezone })),
      hasCalendarData: !!token && Object.keys(busyData).length > 0,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return Response.json({ error: e.message, slots: [] });
  }
}

// ─── Public Holidays API — Fetches from Google Calendar ──────────────────────
// Uses Google Calendar's public holiday calendars (no auth needed, just API key)
// Turkey: en.turkish#holiday@group.v.calendar.google.com  
// Pakistan: en.pk#holiday@group.v.calendar.google.com
//
// ENV: GOOGLE_CALENDAR_API_KEY (get from Google Cloud Console → APIs → Calendar API → Credentials → API Key)

export async function GET() {
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  
  // Fallback: hardcoded gazetted holidays if no API key
  if (!apiKey) {
    return Response.json({ 
      holidays: getHardcodedHolidays(),
      source: 'hardcoded',
      note: 'Set GOOGLE_CALENDAR_API_KEY env var to fetch live holidays from Google Calendar'
    });
  }

  const year = new Date().getFullYear();
  const timeMin = `${year}-01-01T00:00:00Z`;
  const timeMax = `${year}-12-31T23:59:59Z`;

  const calendars = [
    { id: 'en.pk%23holiday%40group.v.calendar.google.com', country: 'PK', label: 'Pakistan' },
    { id: 'en.turkish%23holiday%40group.v.calendar.google.com', country: 'TR', label: 'Turkey' },
    { id: 'en.uk%23holiday%40group.v.calendar.google.com', country: 'UK', label: 'United Kingdom' },
  ];

  const allHolidays = [];

  for (const cal of calendars) {
    try {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${cal.id}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.items) {
        for (const event of data.items) {
          const date = event.start?.date || event.start?.dateTime?.split('T')[0];
          if (!date) continue;
          
          // Check if this date+name combo already exists (shared holidays like Labour Day)
          const existing = allHolidays.find(h => h.d === date && h.l === event.summary);
          if (existing) {
            // Add country to existing entry
            if (!existing.c.includes(cal.country)) {
              existing.c += ',' + cal.country;
            }
          } else {
            allHolidays.push({
              d: date,
              l: event.summary,
              c: cal.country,
              description: event.description || '',
            });
          }
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${cal.label} holidays:`, e);
    }
  }

  // Correct moon-sighted PK Muharram dates (Google estimates these and is often a day off)
  const corrected = allHolidays.filter(h => !(/(muharram|ashura|ashoora|aşure)/i.test(h.l || '') && (h.c || '').includes('PK')));
  corrected.push({ d: '2026-06-25', l: '9 Muharram', c: 'PK' }, { d: '2026-06-26', l: 'Ashura (10 Muharram)', c: 'PK' });

  // Guarantee UK bank holidays are present even if the UK calendar fetch returned nothing
  const UK_2026 = [
    { d: '2026-01-01', l: "New Year's Day", c: 'UK' }, { d: '2026-04-03', l: 'Good Friday', c: 'UK' },
    { d: '2026-04-06', l: 'Easter Monday', c: 'UK' }, { d: '2026-05-04', l: 'Early May Bank Holiday', c: 'UK' },
    { d: '2026-05-25', l: 'Spring Bank Holiday', c: 'UK' }, { d: '2026-08-31', l: 'Summer Bank Holiday', c: 'UK' },
    { d: '2026-12-25', l: 'Christmas Day', c: 'UK' }, { d: '2026-12-28', l: 'Boxing Day (substitute)', c: 'UK' }
  ];
  UK_2026.forEach(u => { if (!corrected.some(h => h.d === u.d && (h.c || '').includes('UK'))) corrected.push(u); });

  // Sort by date
  corrected.sort((a, b) => a.d.localeCompare(b.d));

  return Response.json({
    holidays: corrected,
    source: 'google_calendar',
    year,
    timestamp: new Date().toISOString()
  });
}

// Fallback hardcoded holidays (official 2026 govt notifications)
function getHardcodedHolidays() {
  return [
    {d:"2026-02-05",l:"Kashmir Day",c:"PK"},
    {d:"2026-03-20",l:"Ramazan Bayramı Day 1",c:"TR"},{d:"2026-03-21",l:"Eid-ul-Fitr Day 1 / Ramazan Bayramı Day 2",c:"PK,TR"},{d:"2026-03-22",l:"Eid-ul-Fitr Day 2 / Ramazan Bayramı Day 3",c:"PK,TR"},{d:"2026-03-23",l:"Pakistan Day / Eid-ul-Fitr Day 3",c:"PK"},
    {d:"2026-04-23",l:"National Sovereignty & Children's Day",c:"TR"},
    {d:"2026-05-01",l:"Labour Day",c:"PK,TR"},
    {d:"2026-05-19",l:"Commemoration of Atatürk / Youth Day",c:"TR"},
    {d:"2026-05-26",l:"Hajj Day",c:"PK"},
    {d:"2026-05-27",l:"Eid-ul-Adha Day 1",c:"PK,TR"},{d:"2026-05-28",l:"Eid-ul-Adha Day 2",c:"PK,TR"},{d:"2026-05-29",l:"Eid-ul-Adha Day 3",c:"PK"},{d:"2026-05-30",l:"Kurban Bayramı Day 4",c:"TR"},
    {d:"2026-06-25",l:"9 Muharram",c:"PK"},{d:"2026-06-26",l:"Ashura (10 Muharram)",c:"PK"},
    {d:"2026-07-15",l:"Democracy & National Unity Day",c:"TR"},
    {d:"2026-08-14",l:"Independence Day",c:"PK"},
    {d:"2026-08-25",l:"Eid Milad-un-Nabi",c:"PK,TR"},
    {d:"2026-08-30",l:"Victory Day",c:"TR"},
    {d:"2026-10-29",l:"Republic Day",c:"TR"},
    {d:"2026-11-09",l:"Iqbal Day",c:"PK"},
    {d:"2026-12-25",l:"Quaid-e-Azam Day",c:"PK"},
    {d:"2026-01-01",l:"New Year's Day",c:"UK"},{d:"2026-04-03",l:"Good Friday",c:"UK"},{d:"2026-04-06",l:"Easter Monday",c:"UK"},{d:"2026-05-04",l:"Early May Bank Holiday",c:"UK"},{d:"2026-05-25",l:"Spring Bank Holiday",c:"UK"},{d:"2026-08-31",l:"Summer Bank Holiday",c:"UK"},{d:"2026-12-25",l:"Christmas Day",c:"UK"},{d:"2026-12-28",l:"Boxing Day (substitute)",c:"UK"},
  ];
}

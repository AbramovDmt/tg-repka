const SOURCES = [
  'https://www.avito.ru/calendars-export/79/37/7926314037.ics',
  'https://sutochno.ru/calendar/ical/e228595faf3e8ce95d27dd1c7b57ee0edda0bd7.ics',
];

module.exports = async function handler(req, res) {
  try {
    const results = await Promise.allSettled(
      SOURCES.map((url) =>
        fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; repka-bot/1.0)' } })
          .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.text(); })
      )
    );

    const dates = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const re = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
      let m;
      while ((m = re.exec(result.value)) !== null) {
        const startM = m[0].match(/DTSTART[^:\r\n]*:(\d{8})/);
        const endM   = m[0].match(/DTEND[^:\r\n]*:(\d{8})/);
        if (!startM || !endM) continue;
        let d = icsDate(startM[1]);
        const end = icsDate(endM[1]);
        while (d < end) {
          dates.push(toYMD(d));
          d.setDate(d.getDate() + 1);
        }
      }
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ dates: [...new Set(dates)] });
  } catch (e) {
    res.status(200).json({ dates: [], error: e.message });
  }
};

function icsDate(s) {
  return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
}

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// MijnWeek Widget voor Scriptable
// ════════════════════════════════
// Toont je week-overzicht direct op je iPhone-thuisscherm.
// Gegenereerd via MijnWeek Instellingen → Download voor Scriptable.
// Download opnieuw als je agenda's of klanten wijzigen.
//
// Vereist: Scriptable (gratis in App Store)
// Widget-formaat: Large (aanbevolen) of Medium

// ══════════════════════════════════════════
//  JOUW CONFIGURATIE  (automatisch ingevuld)
// ══════════════════════════════════════════

const WIDGET_CONFIG = {
  calendars: [
    // { name: "Google Agenda", url: "https://...", color: "#3b82f6" }
  ],
  customers: [
    // { name: "Acme Corp", bg: "#ede0ff", text: "#4c1d95" }
  ],
  viewMode: "workdays",   // "workdays" = ma–vr | "week" = ma–zo
  appUrl:   ""            // optioneel: tik op widget opent de web app
};

// ══════════════════════════════════════════
//  DATUM-HULPFUNCTIES
// ══════════════════════════════════════════

function getWeekDates(offset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const diffToMon = (dow === 0) ? -6 : 1 - dow;
  const mon = new Date(today);
  mon.setDate(today.getDate() + diffToMon + (offset || 0) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIcsDate(str) {
  if (!str) return null;
  const s = str.trim();
  // All-day: 20240311
  if (/^\d{8}$/.test(s)) {
    return {
      date: s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8),
      time: null, allDay: true
    };
  }
  // With time: 20240311T090000Z or 20240311T090000
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const iso = m[7] === 'Z'
      ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
      : `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
    const d = new Date(iso);
    return { date: toYMD(d), time: `${m[4]}:${m[5]}`, allDay: false };
  }
  return null;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// ══════════════════════════════════════════
//  ICS OPHALEN & PARSEREN
// ══════════════════════════════════════════

async function fetchIcs(url) {
  try {
    const req = new Request(url);
    req.timeoutInterval = 20;
    return await req.loadString();
  } catch (e) {
    console.error('Fetch mislukt voor: ' + url + ' — ' + e);
    return null;
  }
}

function getProp(block, key) {
  // Matches: KEY:value  OR  KEY;params:value (with possible line folding)
  const re = new RegExp(
    '(?:^|\\r?\\n)' + key + '(?:;[^:\\r\\n]*)?:([^\\r\\n]+(?:\\r?\\n[ \\t][^\\r\\n]+)*)',
    'i'
  );
  const m = block.match(re);
  return m ? m[1].replace(/\r?\n[ \t]/g, '').trim() : null;
}

function unescapeIcs(str) {
  return (str || '')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/g, ' ')
    .replace(/\\\\/g, '\\');
}

function parseIcsForWeek(icsText, calColor, weekDates) {
  const events = [];
  const weekStartYMD = toYMD(weekDates[0]);
  const weekEndYMD   = toYMD(weekDates[6]);

  const blocks = icsText.split(/BEGIN:VEVENT/i);
  blocks.shift();

  for (const block of blocks) {
    const dtStartRaw = getProp(block, 'DTSTART');
    const dtEndRaw   = getProp(block, 'DTEND');
    const summary    = unescapeIcs(getProp(block, 'SUMMARY'));
    const uid        = getProp(block, 'UID') || '';

    if (!dtStartRaw || !summary) continue;

    const start = parseIcsDate(dtStartRaw);
    if (!start) continue;

    const end = dtEndRaw ? parseIcsDate(dtEndRaw) : null;

    // Does event overlap with this week?
    const eventEndYMD = end ? end.date : start.date;
    if (start.date > weekEndYMD) continue;
    if (eventEndYMD < weekStartYMD) continue;
    // All-day end is exclusive (e.g., DTEND=20240312 means up to but not incl. March 12)
    if (start.allDay && end && end.date <= weekStartYMD) continue;

    // Multi-day: expand across week days
    if (end && start.date !== end.date && start.allDay) {
      for (const day of weekDates) {
        const ymd = toYMD(day);
        if (ymd >= start.date && ymd < end.date) {
          events.push({
            uid: uid + ':' + ymd,
            date: ymd,
            title: summary,
            color: calColor,
            allDay: true,
            time: null,
            isTask: true
          });
        }
      }
      continue;
    }

    // Single day (or timed event that starts in this week)
    if (start.date >= weekStartYMD && start.date <= weekEndYMD) {
      events.push({
        uid: uid + ':' + start.date,
        date: start.date,
        title: summary,
        color: calColor,
        allDay: start.allDay,
        time: start.time,
        isTask: start.allDay
      });
    }
  }

  return events;
}

// ══════════════════════════════════════════
//  KLEUREN-HULPFUNCTIES
// ══════════════════════════════════════════

function hex(str, alpha) {
  const c = new Color(str || '#3b82f6');
  if (alpha !== undefined) {
    return new Color(str || '#3b82f6', alpha);
  }
  return c;
}

function hexWithAlpha(hexStr, alpha) {
  // Convert hex to rgba for backgrounds
  const r = parseInt(hexStr.slice(1, 3), 16);
  const g = parseInt(hexStr.slice(3, 5), 16);
  const b = parseInt(hexStr.slice(5, 7), 16);
  return new Color(`#${hexStr.slice(1)}`, alpha);
}

// ══════════════════════════════════════════
//  WIDGET OPBOUWEN
// ══════════════════════════════════════════

const DAY_NL   = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTH_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

async function buildWidget(allEvents, weekDates, isLarge) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color('#141428');
  widget.setPadding(12, 12, 10, 12);
  if (WIDGET_CONFIG.appUrl) widget.url = WIDGET_CONFIG.appUrl;

  const workdays  = WIDGET_CONFIG.viewMode !== 'week';
  const days      = workdays ? weekDates.slice(0, 5) : weekDates;
  const todayYMD  = toYMD(new Date());
  const weekNum   = getWeekNumber(weekDates[0]);
  const d1 = weekDates[0], d7 = weekDates[6];

  // ── Header row ──────────────────────────────────────
  const hdr = widget.addStack();
  hdr.layoutHorizontally();
  hdr.centerAlignContent();

  const titleTxt = hdr.addText('Mijn Week');
  titleTxt.font = Font.boldSystemFont(13);
  titleTxt.textColor = Color.white();
  hdr.addSpacer();

  const rangeStr = `Week ${weekNum}  ·  ${d1.getDate()}–${d7.getDate()} ${MONTH_NL[d7.getMonth()]}`;
  const rangeTxt = hdr.addText(rangeStr);
  rangeTxt.font = Font.systemFont(10);
  rangeTxt.textColor = new Color('#7777aa');

  widget.addSpacer(8);

  // ── Day columns ──────────────────────────────────────
  const row = widget.addStack();
  row.layoutHorizontally();
  row.spacing = 5;

  const maxEventsPerDay = isLarge ? 5 : 3;

  for (const day of days) {
    const ymd    = toYMD(day);
    const isToday = ymd === todayYMD;
    const dayEvs  = allEvents.filter(e => e.date === ymd);

    const col = row.addStack();
    col.layoutVertically();
    col.backgroundColor = isToday ? new Color('#1e2d5a') : new Color('#1e1e38');
    col.cornerRadius = 10;
    col.setPadding(7, 6, 7, 6);

    // Day name
    const dnTxt = col.addText(DAY_NL[day.getDay()].toUpperCase());
    dnTxt.font = Font.boldSystemFont(8);
    dnTxt.textColor = isToday ? new Color('#4f8ef7') : new Color('#6666aa');
    dnTxt.lineLimit = 1;

    col.addSpacer(2);

    // Date number
    const dateTxt = col.addText(String(day.getDate()));
    dateTxt.font = Font.boldSystemFont(15);
    dateTxt.textColor = isToday ? new Color('#4f8ef7') : Color.white();

    col.addSpacer(5);

    // Events
    if (dayEvs.length === 0) {
      const freeTxt = col.addText('–');
      freeTxt.font = Font.systemFont(11);
      freeTxt.textColor = new Color('#33334a');
      freeTxt.lineLimit = 1;
    } else {
      const shown = dayEvs.slice(0, maxEventsPerDay);
      const maxLabelLen = workdays ? (isLarge ? 14 : 11) : (isLarge ? 10 : 8);

      for (const ev of shown) {
        const pill = col.addStack();
        pill.layoutHorizontally();
        pill.cornerRadius = 5;
        pill.backgroundColor = new Color(ev.color, 0.18);
        pill.setPadding(3, 4, 3, 4);

        const dot = pill.addText('●');
        dot.font = Font.systemFont(6);
        dot.textColor = new Color(ev.color);
        pill.addSpacer(3);

        const label = ev.title.length > maxLabelLen
          ? ev.title.slice(0, maxLabelLen - 1) + '…'
          : ev.title;
        const evTxt = pill.addText(label);
        evTxt.font = Font.systemFont(9);
        evTxt.textColor = Color.white();
        evTxt.lineLimit = 1;
        evTxt.minimumScaleFactor = 0.7;

        col.addSpacer(3);
      }

      if (dayEvs.length > maxEventsPerDay) {
        const more = col.addText(`+${dayEvs.length - maxEventsPerDay} meer`);
        more.font = Font.systemFont(8);
        more.textColor = new Color('#5566aa');
      }
    }

    col.addSpacer();
  }

  widget.addSpacer(6);

  // ── Footer: last updated ─────────────────────────────
  const now = new Date();
  const timeStr = `Bijgewerkt ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  const footer = widget.addText(timeStr);
  footer.font = Font.systemFont(8);
  footer.textColor = new Color('#44446a');
  footer.rightAlignText();

  return widget;
}

function buildErrorWidget(msg) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color('#141428');
  widget.addSpacer();
  const t = widget.addText(msg);
  t.font = Font.systemFont(12);
  t.textColor = new Color('#ff6666');
  t.centerAlignText();
  widget.addSpacer();
  return widget;
}

function buildSetupWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color('#141428');
  widget.setPadding(16, 16, 16, 16);
  widget.addSpacer();

  const title = widget.addText('Mijn Week');
  title.font = Font.boldSystemFont(16);
  title.textColor = Color.white();
  title.centerAlignText();

  widget.addSpacer(8);

  const msg = widget.addText('Geen agenda geconfigureerd.\n\nDownload het script opnieuw via:\nInstellingen → Download voor Scriptable');
  msg.font = Font.systemFont(11);
  msg.textColor = new Color('#7777aa');
  msg.centerAlignText();

  widget.addSpacer();
  return widget;
}

// ══════════════════════════════════════════
//  HOOFDPROGRAMMA
// ══════════════════════════════════════════

async function main() {
  if (!WIDGET_CONFIG.calendars || WIDGET_CONFIG.calendars.length === 0) {
    const w = buildSetupWidget();
    Script.setWidget(w);
    if (config.runsInApp) await w.presentLarge();
    return;
  }

  const weekDates = getWeekDates(0);
  let allEvents = [];

  for (const cal of WIDGET_CONFIG.calendars) {
    if (!cal.url) continue;
    const icsText = await fetchIcs(cal.url);
    if (!icsText) continue;
    const evs = parseIcsForWeek(icsText, cal.color || '#3b82f6', weekDates);
    allEvents = allEvents.concat(evs);
  }

  // Dedupliceer op uid
  const seen = new Set();
  allEvents = allEvents.filter(e => {
    if (seen.has(e.uid)) return false;
    seen.add(e.uid);
    return true;
  });

  // Sorteer: vergaderingen eerst, dan taken; daarna op tijd
  allEvents.sort((a, b) => {
    if (a.date !== b.date) return 0;
    if (a.isTask && !b.isTask) return 1;
    if (!a.isTask && b.isTask) return -1;
    return (a.time || '') < (b.time || '') ? -1 : 1;
  });

  const isLarge = config.widgetFamily === 'large' || config.runsInApp;
  const widget = await buildWidget(allEvents, weekDates, isLarge);
  Script.setWidget(widget);

  if (config.runsInApp) {
    await widget.presentLarge();
  }
}

await main();

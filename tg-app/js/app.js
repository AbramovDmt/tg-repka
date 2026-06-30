/* ═══════════════════════════════════════════════════════════
   app.js — логика приложения
   Роутер, экраны, компоненты, обработчики событий.
   ═══════════════════════════════════════════════════════════ */

/* ═══ СОСТОЯНИЕ ═══════════════════════════════════════════ */

const state = {
  booking:      { checkIn: null, checkOut: null, guests: 2, comment: '' },
  sauna:        { date: null, slot: null, duration: 3, comment: '', standaloneOverride: false, broom: false },
  bikes:        { count: 1, sup: 0, duration: '2h', comment: '' },
  cal:          { year: new Date().getFullYear(), month: new Date().getMonth() },
  nearby:       { tab: 'Природа' },
  success:      { type: 'booking' },
  bookingFlow:  false, // true when sauna/bikes upsell is part of a house booking
  currentOrder: { house: null, sauna: null, bikes: null },
  orderComment: '',
};

/* ═══ TELEGRAM SDK ══════════════════════════════════════════ */

const tg = window.Telegram?.WebApp || null;

function initTelegram() {
  if (tg) {
    tg.ready();
    tg.expand();
    applyTheme(tg.colorScheme);
    tg.onEvent('themeChanged', () => applyTheme(tg.colorScheme));
    tg.BackButton.onClick(() => router.back());
  } else {
    applyTheme('light');
  }
}

function applyTheme(scheme) {
  document.body.classList.toggle('dark', scheme === 'dark');
  const meta = document.getElementById('meta-theme');
  if (meta) meta.content = scheme === 'dark' ? '#0D1B0F' : '#F7F4EF';
}

/* MainButton — единственная нижняя кнопка Telegram */
function setMainButton(text, cb, active = true) {
  if (!tg) return;
  const mb = tg.MainButton;
  mb.setText(text);
  mb.offClick(mb._appCb);
  mb._appCb = cb;
  mb.onClick(cb);
  active ? mb.enable() : mb.disable();
  mb.show();
}

function hideMainButton() {
  tg?.MainButton.hide();
}

function showBackButton(show) {
  if (!tg) return;
  show ? tg.BackButton.show() : tg.BackButton.hide();
}

function haptic(type = 'light') {
  tg?.HapticFeedback?.impactOccurred(type);
}

function hapticNotify(type = 'success') {
  tg?.HapticFeedback?.notificationOccurred(type);
}

/* ═══ РОУТЕР ════════════════════════════════════════════════ */

const router = {
  stack: [],

  navigate(screenId, params = {}, direction = 'forward') {
    if (direction === 'forward') {
      this.stack.push({ id: screenId, params });
    }
    this._render(screenId, params, direction);
  },

  back() {
    if (this.stack.length <= 1) return;
    this.stack.pop();
    const prev = this.stack[this.stack.length - 1];
    this._render(prev.id, prev.params, 'back');
  },

  reset() {
    this.stack = [{ id: 'home', params: {} }];
    this._render('home', {}, 'fade');
  },

  _render(screenId, params, direction) {
    const fn = screens[screenId];
    if (!fn) return;

    const BACK_BTN = `<button class="app-back-btn" data-action="goBack" aria-label="Назад"><svg width="10" height="17" viewBox="0 0 10 17" fill="none"><path d="M9 1L1.5 8.5L9 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;

    let html = fn(params);

    // Вставляем кнопку назад прямо в HTML — перед заголовком шапки
    if (this.stack.length > 1) {
      html = html.replace('<div class="screen-header">', `<div class="screen-header">${BACK_BTN}`);
    }

    const container = document.getElementById('screen-container');
    container.innerHTML = `<div class="screen anim-${direction}">${html}</div>`;
    window.scrollTo(0, 0);

    showBackButton(this.stack.length > 1);
    setupScreenButtons(screenId, params);
    afterRender(screenId);
    updateTabBar(screenId);
  },
};

/* ═══ ТАБ-БАР ══════════════════════════════════════════════ */

const TAB_SCREENS = { home: 'home', booking: 'booking', sauna: 'sauna', more: 'more' };

const SCREEN_TAB = {
  home: 'home', house: 'home',
  booking: 'booking', upsellSauna: 'booking', upsellBikes: 'booking',
  sauna: 'sauna',
  more: 'more', bikes: 'more', nearby: 'more', instructions: 'more', contact: 'more',
};

const TAB_ICONS = {
  home:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z"/><path d="M9 22V13h6v9"/></svg>`,
  booking: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  sauna:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 5-5 7-5 12a5 5 0 0 0 10 0c0-3-1.2-5-2-7-1 2.5-2 3.5-3 3.5 1-2.5 0-5.5 0-8.5z"/></svg>`,
  more:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
};

const INSTR_ICONS = {
  directions:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`,
  checkin:     `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  wifi:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>`,
  'sauna-use': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 5-5 7-5 12a5 5 0 0 0 10 0c0-3-1.2-5-2-7-1 2.5-2 3.5-3 3.5 1-2.5 0-5.5 0-8.5z"/></svg>`,
  bbq:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="12" y1="9" x2="12" y2="20"/><path d="M6 9C6 5.5 8 3 12 3s6 2.5 6 6"/><line x1="9" y1="20" x2="15" y2="20"/></svg>`,
  rules:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  emergency:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.75a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
};

const MORE_ICONS = {
  house:        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z"/><path d="M9 22V13h6v9"/></svg>`,
  bikes:        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17l3.5-9h5l2.5 4.5"/><path d="M9 8l3 9"/></svg>`,
  nearby:       `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  instructions: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>`,
  contact:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};

function renderTabBar() {
  const nav = document.createElement('nav');
  nav.id = 'tab-bar';
  nav.innerHTML = [
    { id: 'home',    label: 'Домик'      },
    { id: 'booking', label: 'Бронировать' },
    { id: 'sauna',   label: 'Баня'        },
    { id: 'more',    label: 'Ещё'         },
  ].map(t => `
    <button class="tab-btn" data-tab="${t.id}">
      <span class="tab-btn-icon">${TAB_ICONS[t.id]}</span>
      <span class="tab-btn-label">${t.label}</span>
    </button>`).join('');
  document.getElementById('app').appendChild(nav);
  nav.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    haptic('light');
    switchTab(btn.dataset.tab);
  });
}

function switchTab(tabId) {
  const screenId = TAB_SCREENS[tabId] || tabId;
  router.stack = [{ id: screenId, params: {} }];
  router._render(screenId, {}, 'fade');
}

function updateTabBar(screenId) {
  const activeTab = SCREEN_TAB[screenId] || null;
  document.querySelectorAll('#tab-bar .tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === activeTab));
  const bar = document.getElementById('tab-bar');
  if (bar) bar.classList.toggle('hidden', !activeTab);
}

/* ═══ УТИЛИТЫ ═══════════════════════════════════════════════ */

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDate(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

function fmtPrice(n) { return n.toLocaleString('ru-RU') + ' ₽'; }

function dateLabel(ds) {
  if (!ds) return '—';
  const [y, m, d] = ds.split('-').map(Number);
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const days   = ['вс','пн','вт','ср','чт','пт','сб'];
  return `${d} ${months[m-1]}, ${days[new Date(y, m-1, d).getDay()]}`;
}

function nightLabel(n) {
  if (n === 1) return 'ночь';
  if (n < 5)  return 'ночи';
  return 'ночей';
}

function isWeekendDate(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const dow = new Date(y, m-1, d).getDay();
  return dow === 5 || dow === 6; // пт сб
}

function calcBooking() {
  const { checkIn, checkOut } = state.booking;
  if (!checkIn || !checkOut) return null;

  const from = new Date(checkIn), to = new Date(checkOut);
  const nights = Math.round((to - from) / 86400000);
  if (nights <= 0) return null;

  let nightsTotal = 0;
  for (let i = 0; i < nights; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const ds = fmtDate(d.getFullYear(), d.getMonth()+1, d.getDate());
    nightsTotal += isWeekendDate(ds) ? APP_DATA.house.priceWeekend : APP_DATA.house.priceWeekday;
  }
  return { nights, nightsTotal, saunaTotal: 0, total: nightsTotal };
}

function calcSauna() {
  return APP_DATA.sauna.pricePerHour * state.sauna.duration + (state.sauna.broom ? APP_DATA.sauna.broomPrice : 0);
}

function calcSaunaPerDay(nights) {
  if (nights <= 0) return 0;
  return APP_DATA.sauna.pricePerDay + Math.max(0, nights - 1) * APP_DATA.sauna.pricePerDayExtra;
}

function calcBikes() {
  return APP_DATA.bikes.priceDay * state.bikes.count + APP_DATA.sup.priceDay * state.bikes.sup;
}

/* ═══ КОМПОНЕНТЫ ════════════════════════════════════════════ */

function renderCalendar() {
  const { year, month } = state.cal;
  const today = new Date();
  const todayStr = fmtDate(today.getFullYear(), today.getMonth()+1, today.getDate());

  const firstDow  = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Пн
  const daysInMon = new Date(year, month+1, 0).getDate();

  const MON = ['Январь','Февраль','Март','Апрель','Май','Июнь',
               'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  const { checkIn, checkOut } = state.booking;

  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += '<div class="cal-cell"></div>';

  for (let d = 1; d <= daysInMon; d++) {
    const ds = fmtDate(year, month+1, d);
    const cellDate  = new Date(year, month, d);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isPast    = cellDate < todayDate;
    const isBusy    = APP_DATA.unavailableDates.includes(ds);
    const disabled  = isPast || isBusy;

    const isCI = checkIn  === ds;
    const isCO = checkOut === ds;
    const inRng = checkIn && checkOut && ds > checkIn && ds < checkOut;
    const isToday = ds === todayStr;
    const dow = cellDate.getDay();
    const isWknd = (dow === 0 || dow === 6);

    let cls = 'cal-cell';
    if (disabled)           cls += ' disabled';
    if (isBusy && !isPast)  cls += ' booked';
    if (isToday && !disabled && !isCI && !isCO) cls += ' today';
    if (isWknd && !disabled && !isCI && !isCO)  cls += ' weekend-day';
    if (isCI)               cls += ' check-in';
    if (isCO)               cls += ' check-out';
    if (inRng)              cls += ' in-range';

    const attr = !disabled ? `data-action="pickDate" data-date="${ds}"` : '';
    cells += `<div class="${cls}" ${attr}>${d}</div>`;
  }

  const canPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());

  return `
    <div class="calendar">
      <div class="cal-header">
        <button class="cal-nav${canPrev ? '' : ' invisible'}" data-action="calPrev">‹</button>
        <span class="cal-title">${MON[month]} ${year}</span>
        <button class="cal-nav" data-action="calNext">›</button>
      </div>
      <div class="cal-weekdays">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span>
        <span class="wknd">Сб</span><span class="wknd">Вс</span>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend">
        <div class="legend-item"><div class="l-dot booked-dot"></div><span>Занято</span></div>
        <div class="legend-item"><div class="l-dot today-dot"></div><span>Сегодня</span></div>
        <div class="legend-item"><div class="l-dot sel-dot"></div><span>Выбрано</span></div>
      </div>
    </div>`;
}

function renderDateStrip(selectedDate) {
  const today = new Date();
  const DAYS  = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const MONS  = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

  let html = '<div class="date-strip">';
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = fmtDate(d.getFullYear(), d.getMonth()+1, d.getDate());
    const allBusy = (APP_DATA.sauna.bookedSlots[ds] || []).length === APP_DATA.sauna.slots.length;
    const isSel   = ds === selectedDate;

    html += `
      <div class="date-chip${isSel ? ' selected' : ''}${allBusy ? ' fully-booked' : ''}"
           data-action="selectSaunaDate" data-date="${ds}">
        <span class="dc-day">${i === 0 ? 'Сег' : DAYS[d.getDay()]}</span>
        <span class="dc-num">${d.getDate()}</span>
        <span class="dc-mon">${MONS[d.getMonth()]}</span>
      </div>`;
  }
  return html + '</div>';
}

function renderSlotGrid(date) {
  if (!date) return '<div class="no-date-hint">Выберите дату выше</div>';

  const booked = APP_DATA.sauna.bookedSlots[date] || [];
  const { slot: selSlot, duration } = state.sauna;

  let html = '<div class="slot-grid">';
  for (const slot of APP_DATA.sauna.slots) {
    const isBusy = booked.includes(slot);
    const isSel  = slot === selSlot;
    const [h]    = slot.split(':').map(Number);
    const endH   = Math.min(h + duration, 22);
    const endStr = `${pad(endH)}:00`;

    let cls = 'slot-chip';
    if (isBusy) cls += ' booked';
    if (isSel)  cls += ' selected';

    const attr = !isBusy ? `data-action="selectSlot" data-slot="${slot}"` : '';
    const lbl  = isBusy ? 'Занято' : isSel ? `до ${endStr}` : 'Своб.';

    html += `
      <div class="${cls}" ${attr}>
        <span class="slot-time">${slot}</span>
        <span class="slot-label">${lbl}</span>
      </div>`;
  }
  return html + '</div>';
}

/* ═══ ЭКРАНЫ ════════════════════════════════════════════════ */

const screens = {

  /* ── Онбординг ─────────────────────────────────────────── */
  onboarding: () => {
    const user = tg?.initDataUnsafe?.user;
    const name = user?.first_name || '';
    const greeting = name ? `Привет, ${name}!` : 'Привет!';

    return `
      <div class="onboarding-screen">
        <div class="onboarding-hero"></div>
        <div class="onboarding-content">
          <h1 class="onboarding-title">${greeting}</h1>
          <p class="onboarding-sub">Это приложение для бронирования домика в берёзовой роще у Канала&nbsp;им.&nbsp;Москвы.</p>
          <div class="onboarding-features">
            <p class="of-caption">Здесь можно:</p>
            <div class="onboarding-feature">
              <span class="of-check">✓</span>
              <span class="of-text">Выбрать даты и забронировать домик</span>
            </div>
            <div class="onboarding-feature">
              <span class="of-check">✓</span>
              <span class="of-text">Забронировать баню и велосипеды</span>
            </div>
            <div class="onboarding-feature">
              <span class="of-check">✓</span>
              <span class="of-text">Найти интересные места рядом</span>
            </div>
          </div>
          <button class="btn-primary onboarding-btn" data-action="startApp">Начать</button>
          <p class="onboarding-hint">63 км от Москвы · Дмитровское шоссе</p>
        </div>
      </div>`;
  },

  /* ── Главная ───────────────────────────────────────────── */
  home: () => {
    const d = APP_DATA.house;
    return `
    <div class="home-screen">
      <div class="hero">
        <div class="hero-image"></div>
        <div class="hero-overlay"></div>
        <div class="hero-badge">63 км от Москвы · Дмитровский район</div>
        <div class="hero-content">
          <h1 class="hero-title">Репка.<br>Домик в роще.</h1>
          <p class="hero-sub">Лес · Тишина · Баня</p>
        </div>
      </div>

      <div class="home-content">
        <p class="home-lead">Место, куда приезжают, чтобы выдохнуть.</p>

        <div class="home-info-card" data-action="navigate" data-screen="house">
          <div class="home-info-row">
            <span class="home-info-label">Цена</span>
            <span class="home-info-value">от ${fmtPrice(d.priceWeekday)}/ночь</span>
          </div>
          <div class="home-info-row">
            <span class="home-info-label">Гости</span>
            <span class="home-info-value">до ${APP_DATA.house.capacity} человек</span>
          </div>
          <div class="home-info-row">
            <span class="home-info-label">Площадь</span>
            <span class="home-info-value">${d.area} м² · ${d.floors} этажа</span>
          </div>
          <div class="home-info-row">
            <span class="home-info-label">Заезд / выезд</span>
            <span class="home-info-value">с ${d.checkIn} / до ${d.checkOut}</span>
          </div>
          <div class="home-info-cta"><span>Подробнее о домике</span><span>›</span></div>
        </div>

        <button class="btn-primary home-book-btn" data-action="navigate" data-screen="booking">
          Забронировать
        </button>

        <div class="home-contact" data-action="share">
          <span>Поделиться с другом</span>
          <span class="arrow">›</span>
        </div>
      </div>
    </div>`;
  },

  /* ── Домик ─────────────────────────────────────────────── */
  house: () => {
    const d = APP_DATA.house;
    const gallery = d.gallery.map(item => `
      <div class="gallery-item" style="${item.image
        ? `background-image:url('${item.image}');background-size:cover;background-position:center`
        : `background:${item.gradient}`}">
        <div class="gallery-label">${item.label}</div>
      </div>`).join('');

    const amenities = d.amenities.map(a => `
      <div class="amenity-item">
        <span class="amenity-label">${a.label}</span>
      </div>`).join('');

    const rules = d.rules.map(r => `<li>${r}</li>`).join('');

    return `
      <div class="house-screen">
        <div class="screen-header"><h2 class="screen-title">Домик</h2></div>

        <div class="gallery-wrap">
          <div class="gallery" id="gallery">${gallery}</div>
          <div class="gallery-dots" id="gallery-dots">
            ${d.gallery.map((_, i) => `<div class="dot${i===0?' active':''}"></div>`).join('')}
          </div>
        </div>

        <div class="screen-content" style="padding-top:0">
          <div class="house-title-row">
            <div>
              <h2 class="house-name">${d.name}</h2>
              <p class="house-meta">${d.area} м² · ${d.floors} этажа · до ${APP_DATA.house.capacity} гостей</p>
            </div>
            <div class="price-badge">от ${fmtPrice(d.priceWeekday)}<span class="per-night">/ночь</span></div>
          </div>

          <p class="house-desc">${d.description}</p>

          <div class="section-card">
            <h3 class="section-title">Что включено</h3>
            <div class="amenities-grid">${amenities}</div>
          </div>

          <div class="section-card">
            <h3 class="section-title">Заезд и выезд</h3>
            <div class="checkin-row">
              <div class="checkin-item">
                <span class="ci-label">Заезд</span>
                <span class="ci-value">с ${d.checkIn}</span>
              </div>
              <div class="checkin-item">
                <span class="ci-label">Выезд</span>
                <span class="ci-value">до ${d.checkOut}</span>
              </div>
            </div>
          </div>

          <div class="section-card">
            <h3 class="section-title">Правила</h3>
            <ul class="rules-list" style="padding-bottom:12px">${rules}</ul>
          </div>
        </div>

      </div>`;
  },

  /* ── Бронирование ──────────────────────────────────────── */
  booking: () => {
    const price = calcBooking();
    const { checkIn, checkOut, guests, comment } = state.booking;

    const selBlock = checkIn ? `
      <div class="selected-dates">
        <div class="sel-date-item">
          <span class="sel-label">Заезд</span>
          <span class="sel-value">${dateLabel(checkIn)}</span>
        </div>
        <div class="sel-date-divider">→</div>
        <div class="sel-date-item">
          <span class="sel-label">Выезд</span>
          <span class="sel-value">${checkOut ? dateLabel(checkOut) : '—'}</span>
        </div>
      </div>` : '';

    const preSauna      = state.currentOrder?.sauna?.perDay && price && !price.saunaTotal;
    const preSaunaPrice = preSauna ? state.currentOrder.sauna.price : 0;
    const displayTotal  = price ? price.total + preSaunaPrice : 0;

    const priceBlock = price ? `
      <div class="section-card price-block">
        <div class="price-row">
          <span>${price.nights} ${nightLabel(price.nights)} × стоимость</span>
          <span>${fmtPrice(price.nightsTotal)}</span>
        </div>
        ${preSauna ? `
        <div class="price-row">
          <span>Баня <span class="remove-item" data-action="removeSaunaPreBooking">✕ убрать</span></span>
          <span>${fmtPrice(preSaunaPrice)}</span>
        </div>` : ''}
        <div class="price-row total">
          <span>Итого</span>
          <span>${fmtPrice(displayTotal)}</span>
        </div>
      </div>` : '';

    return `
      <div class="booking-screen">
        <div class="screen-header"><h2 class="screen-title">Бронирование</h2></div>

        <div class="screen-content">
          <div class="section-card cal-section">${renderCalendar()}</div>

          ${selBlock}

          <div class="section-card">
            <div class="counter-row">
              <span class="counter-label">Гости</span>
              <div class="counter">
                <button class="counter-btn" data-action="changeGuests" data-delta="-1">−</button>
                <span class="counter-value">${guests} ${guests===1?'человек':guests<5?'человека':'человек'}</span>
                <button class="counter-btn" data-action="changeGuests" data-delta="1">+</button>
              </div>
            </div>
          </div>

          ${priceBlock}

          <div class="section-card">
            <label class="comment-label">Вопрос или пожелание хозяину <span class="optional">(необязательно)</span></label>
            <textarea class="comment-input" id="booking-comment"
              placeholder="Поздний заезд, нужна кроватка, вопрос…">${comment}</textarea>
            <div class="pets-hint">
              <span>Едете с питомцем? Напишите об этом — обсуждается индивидуально. Залог с животными 10 000 ₽, на участке не выгуливать.</span>
            </div>
          </div>

          <div class="cancellation-note">
            <span class="cancel-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg></span>
            <span>Отмена брони за 7 суток — бесплатно. Менее 7 суток — залог не возвращается.</span>
          </div>

          <button class="btn-primary" id="booking-submit-btn"
            data-action="submitBooking"
            ${checkIn && checkOut ? '' : 'disabled'}>
            ${price ? `Отправить заявку · ${fmtPrice(displayTotal)}` : 'Выберите даты'}
          </button>

          <div class="platform-section">
            <p class="platform-label">Или забронировать через площадку:</p>
            <div class="platform-btns">
              <div class="btn-platform" data-action="openLink" data-url="https://www.cian.ru/rent/suburban/325890116">ЦИАН</div>
              <div class="btn-platform" data-action="openLink" data-url="https://sutochno.ru/front/searchapp/detail/1840600?host_id=14014121&host_device=app&guest_id=">Суточно.ру</div>
            </div>
          </div>
        </div>
        <div class="screen-bottom-space"></div>
      </div>`;
  },

  /* ── Баня ──────────────────────────────────────────────── */
  sauna: () => {
    const { checkIn, checkOut } = state.booking;
    const hasHouseDates = checkIn && checkOut && !state.sauna.standaloneOverride;

    if (hasHouseDates) {
      const nights     = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
      const saunaPrice = calcSaunaPerDay(nights);
      const saunaMetaLabel = nights > 1
        ? `${fmtPrice(APP_DATA.sauna.pricePerDay)} 1-я ночь · ${fmtPrice(APP_DATA.sauna.pricePerDayExtra)} × ${nights - 1} след.`
        : `${fmtPrice(APP_DATA.sauna.pricePerDay)} за ночь`;
      const alreadyAdded = state.currentOrder?.sauna?.perDay;

      return `
        <div class="sauna-screen">
          <div class="screen-header"><h2 class="screen-title">Баня</h2></div>
          ${renderSaunaGallery()}
          <div class="sauna-hero-info">до ${APP_DATA.sauna.capacity} чел. · отдельный домик 6×4 м</div>
          <div class="screen-content">
            <div class="section-card">
              <div class="sauna-booking-context">
                <div class="sbc-label">К вашей брони домика</div>
                <div class="sbc-dates">${dateLabel(checkIn)} — ${dateLabel(checkOut)} · ${nights} ${nightLabel(nights)}</div>
              </div>
              <div class="sbc-price-row">
                <div class="sbc-price-left">
                  <div class="sbc-price-name">Баня — весь период</div>
                  <div class="sbc-price-meta">${saunaMetaLabel}</div>
                </div>
                <div class="sbc-price-total">${fmtPrice(saunaPrice)}</div>
              </div>
            </div>

            <div class="section-card">
              <label class="comment-label">Комментарий / вопрос <span class="optional">(необязательно)</span></label>
              <textarea class="comment-input" id="sauna-comment"
                placeholder="Сколько человек, нужны ли веники, есть вопросы…">${state.sauna.comment}</textarea>
            </div>

            ${alreadyAdded
              ? `<div class="sauna-added-notice">✓ Баня добавлена к брони домика</div>
                 <button class="btn-outline" data-action="removeSaunaPreBooking">Убрать баню</button>`
              : `<button class="btn-primary" data-action="addSaunaPreBooking">
                   Добавить к брони · ${fmtPrice(saunaPrice)}
                 </button>`}

            <button class="btn-outline" data-action="switchToStandaloneMode">
              Только баня без домика — по часам
            </button>
          </div>
          <div class="screen-bottom-space"></div>
        </div>`;
    }

    /* ── Обычный режим: почасовая аренда ── */
    const { date, slot, duration, comment } = state.sauna;
    const price = calcSauna();
    const [h]   = slot ? slot.split(':').map(Number) : [0];
    const endT  = slot ? `${pad(Math.min(h+duration, 22))}:00` : '';
    const ok    = !!(date && slot);

    return `
      <div class="sauna-screen">
        <div class="screen-header"><h2 class="screen-title">Баня</h2></div>

        ${renderSaunaGallery()}
        <div class="sauna-hero-info">${APP_DATA.sauna.pricePerHour.toLocaleString('ru-RU')} ₽/час · до ${APP_DATA.sauna.capacity} чел. · мин. 3 часа</div>

        <div class="screen-content">
          <div class="section-card">
            <h3 class="section-title">Выберите дату</h3>
            ${renderDateStrip(date)}
          </div>

          <div class="section-card">
            <h3 class="section-title" id="slots-title">Доступные слоты${date ? ' — ' + dateLabel(date) : ''}</h3>
            ${renderSlotGrid(date)}
          </div>

          <div class="section-card">
            <h3 class="section-title">Длительность</h3>
            <div class="duration-picker">
              ${[3,4,5].map(n => `
                <div class="duration-chip${duration===n?' selected':''}"
                     data-action="selectDuration" data-duration="${n}">${n} ${n===5?'часов':'часа'}</div>`).join('')}
            </div>
          </div>

          <div class="section-card">
            <h3 class="section-title">Веник <span class="optional">(если нет своего)</span></h3>
            <div class="duration-picker">
              <div class="duration-chip${!state.sauna.broom ? ' selected' : ''}"
                   data-action="toggleSaunaBroom" data-broom="0">Свой</div>
              <div class="duration-chip${state.sauna.broom ? ' selected' : ''}"
                   data-action="toggleSaunaBroom" data-broom="1">+${fmtPrice(APP_DATA.sauna.broomPrice)}</div>
            </div>
          </div>

          ${slot
            ? `<div class="booking-summary">
                <div class="summary-row"><span>${dateLabel(date)}</span></div>
                <div class="summary-row">
                  <span>${slot} — ${endT}</span>
                  <span class="summary-price" id="sauna-price">${fmtPrice(price)}</span>
                </div>
               </div>`
            : `<div class="hint-block">Выберите дату и слот для бронирования</div>`}

          <div class="section-card">
            <label class="comment-label">Комментарий / вопрос <span class="optional">(необязательно)</span></label>
            <textarea class="comment-input" id="sauna-comment"
              placeholder="Сколько человек, нужны ли веники, есть вопросы…">${comment}</textarea>
          </div>

          <button class="btn-primary" id="sauna-submit-btn"
            data-action="submitSauna"
            ${ok ? '' : 'disabled'}>
            ${ok ? `Забронировать баню · ${fmtPrice(price)}` : 'Выберите дату и слот'}
          </button>
        </div>
        <div class="screen-bottom-space"></div>
      </div>`;
  },

  /* ── Велосипеды ────────────────────────────────────────── */
  bikes: () => {
    const { count } = state.bikes;
    const inFlow    = state.bookingFlow;
    const bikesTotal = calcBikes();
    const prevTotal  = (state.currentOrder?.house?.price || 0) + (state.currentOrder?.sauna?.price || 0);
    const grandTotal = prevTotal + bikesTotal;

    const orderBlock = inFlow ? `
      <div class="section-card price-block" id="bikes-order-block">
        ${state.currentOrder?.house ? `
        <div class="price-row">
          <span>${state.currentOrder.house.saunaIncluded ? 'Домик + баня' : 'Домик'}</span>
          <span>${fmtPrice(state.currentOrder.house.price)}</span>
        </div>` : ''}
        ${state.currentOrder?.sauna ? `
        <div class="price-row">
          <span>Баня</span>
          <span>${fmtPrice(state.currentOrder.sauna.price)}</span>
        </div>` : ''}
        <div class="price-row" id="bikes-price-row">
          <span>Велосипеды</span>
          <span id="bike-sum-price">${fmtPrice(bikesTotal)}</span>
        </div>
        <div class="price-row total" id="bikes-grand-total">
          <span>Итого</span>
          <span>${fmtPrice(grandTotal)}</span>
        </div>
      </div>` : `
      <div class="booking-summary">
        ${count > 0 ? `
        <div class="summary-row">
          <span id="bike-sum-label">${count} велосипед${count>1?'а':''} · весь день</span>
          <span class="summary-price" id="bike-sum-price">${fmtPrice(APP_DATA.bikes.priceDay * count)}</span>
        </div>` : '<span id="bike-sum-label" style="display:none"></span><span id="bike-sum-price" style="display:none"></span>'}
        <div class="summary-row" id="sup-sum-row"${state.bikes.sup > 0 ? '' : ' style="display:none"'}>
          <span id="sup-sum-label">${state.bikes.sup} SUP · весь день</span>
          <span class="summary-price" id="sup-sum-price">${fmtPrice(APP_DATA.sup.priceDay * state.bikes.sup)}</span>
        </div>
      </div>`;

    const hasItems = state.bikes.count > 0 || state.bikes.sup > 0;
    const btnLabel = inFlow
      ? `Завершить бронирование · ${fmtPrice(grandTotal)}`
      : (hasItems ? `Забронировать · ${fmtPrice(bikesTotal)}` : 'Выберите велосипед или SUP');

    return `
      <div class="bikes-screen">
        <div class="screen-header"><h2 class="screen-title">Велосипеды и SUP</h2></div>

        <div class="bikes-hero">
          <div class="bikes-hero-image"></div>
          <div class="bikes-hero-info">
            ${APP_DATA.bikes.available} велика · ${APP_DATA.bikes.priceDay} ₽/день · SUP ${APP_DATA.sup.priceDay} ₽/день
          </div>
        </div>

        <div class="screen-content">
          <div class="section-card">
            <div class="counter-row">
              <div>
                <div class="counter-label">Велосипеды</div>
                <div class="counter-hint">Максимум ${APP_DATA.bikes.available} · ${APP_DATA.bikes.priceDay} ₽/день · за штуку</div>
              </div>
              <div class="counter">
                <button class="counter-btn" data-action="changeBikeCount" data-delta="-1">−</button>
                <span class="counter-value">${count}</span>
                <button class="counter-btn" data-action="changeBikeCount" data-delta="1">+</button>
              </div>
            </div>
            <div class="counter-row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--divider)">
              <div>
                <div class="counter-label">SUP-борд</div>
                <div class="counter-hint">Максимум ${APP_DATA.sup.available} · ${APP_DATA.sup.priceDay} ₽/день · за штуку</div>
              </div>
              <div class="counter">
                <button class="counter-btn" data-action="changeSUPCount" data-delta="-1">−</button>
                <span class="counter-value-sup">${state.bikes.sup}</span>
                <button class="counter-btn" data-action="changeSUPCount" data-delta="1">+</button>
              </div>
            </div>
          </div>

          ${orderBlock}

          <div class="section-card routes-section">
            <h3 class="section-title">Популярные маршруты</h3>
            ${APP_DATA.bikes.routes.map(r => `
              <div class="route-item">
                <span class="route-name">${r.name}</span>
                <span class="route-meta">${r.distance} · ${r.time}</span>
              </div>`).join('')}
          </div>

          <div class="cancellation-note">
            <span class="cancel-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg></span>
            <span>Вернуть велосипеды до ${APP_DATA.bikes.returnTime}. Выдаёт хозяин при заезде.</span>
          </div>

          <div class="section-card">
            <label class="comment-label">Комментарий / вопрос <span class="optional">(необязательно)</span></label>
            <textarea class="comment-input" id="bikes-comment"
              placeholder="Нужен ли детский велосипед, шлем, есть вопросы…">${state.bikes.comment}</textarea>
          </div>

          <button class="btn-primary" id="bikes-submit-btn" data-action="submitBikes"
            ${hasItems || inFlow ? '' : 'disabled'}>
            ${btnLabel}
          </button>
        </div>
        <div class="screen-bottom-space"></div>
      </div>`;
  },

  /* ── Что рядом ─────────────────────────────────────────── */
  nearby: () => {
    const { tab } = state.nearby;
    const tabs   = Object.keys(APP_DATA.nearby);
    const places = APP_DATA.nearby[tab] || [];

    const placesList = places.map(p => `
      <div class="place-card">
        <div class="place-info">
          <div class="place-name">${p.name}</div>
          <div class="place-desc">${p.desc}</div>
          <div class="place-meta">
            <span class="place-dist">${p.distance}</span>
            <span class="place-time">${p.time}</span>
          </div>
        </div>
        ${p.mapsUrl ? `<div class="place-action" data-action="openLink" data-url="${p.mapsUrl}">›</div>` : ''}
      </div>`).join('');

    return `
      <div class="nearby-screen">
        <div class="screen-header"><h2 class="screen-title">Что рядом</h2></div>

        <div class="map-section">
          <div class="map-placeholder">
            <div class="map-content">
              <div class="map-pin"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg></div>
              <span>Домик в роще</span>
              <span class="map-coords">56.48085, 37.42054</span>
            </div>
          </div>
          <div class="btn-open-maps" data-action="openLink"
               data-url="https://yandex.ru/maps/?pt=37.42054,56.48085&z=14">
            Открыть в Яндекс.Картах
          </div>
        </div>

        <div class="screen-content">
          <div class="tab-bar">
            ${tabs.map(t => `
              <div class="tab-item${tab===t?' active':''}"
                   data-action="setNearbyTab" data-tab="${t}">${t}</div>`).join('')}
          </div>
          <div class="places-list">${placesList}</div>
        </div>
      </div>`;
  },

  /* ── Инструкции ────────────────────────────────────────── */
  instructions: () => `
    <div class="instructions-screen">
      <div class="screen-header"><h2 class="screen-title">Инструкции</h2></div>
      <div class="screen-content">
        <div class="section-card accordion-wrap">
          ${APP_DATA.instructions.map(item => `
            <div class="accordion-item" id="acc-${item.id}">
              <div class="accordion-header" data-action="toggleAcc" data-id="${item.id}">
                <span class="acc-title"><span class="acc-icon">${INSTR_ICONS[item.id] || ''}</span>${item.title}</span>
                <span class="accordion-arrow">›</span>
              </div>
              <div class="accordion-content" id="ac-${item.id}">
                <div class="accordion-body">${item.content}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`,

  /* ── Контакты ──────────────────────────────────────────── */
  contact: () => {
    const c = APP_DATA.contact;
    const faq = c.faq.map((item, i) => `
      <div class="accordion-item" id="acc-faq${i}">
        <div class="accordion-header" data-action="toggleAcc" data-id="faq${i}">
          <span>${item.q}</span>
          <span class="accordion-arrow">›</span>
        </div>
        <div class="accordion-content" id="ac-faq${i}">
          <div class="accordion-body">${item.a}</div>
        </div>
      </div>`).join('');

    return `
      <div class="contact-screen">
        <div class="screen-header"><h2 class="screen-title">Хозяин</h2></div>
        <div class="screen-content">
          <div class="host-card section-card">
            <div class="host-avatar">${c.name[0]}</div>
            <div class="host-info">
              <div class="host-name">${c.name}</div>
              <div class="host-role">${c.role}</div>
            </div>
          </div>

          <div class="contact-btns">
            <div class="contact-btn" data-action="openLink" data-url="https://t.me/${c.telegram}">
              <span class="contact-btn-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
              <span class="contact-btn-label">Написать в Telegram</span>
              <span class="contact-btn-arrow">›</span>
            </div>
            <div class="contact-btn" data-action="openLink" data-url="tel:${c.phone}">
              <span class="contact-btn-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.75a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
              <span class="contact-btn-label">Позвонить</span>
              <span class="contact-btn-arrow">›</span>
            </div>
          </div>

          <div class="section-card accordion-wrap">
            <h3 class="section-title" style="padding:12px 16px 0">Частые вопросы</h3>
            ${faq}
          </div>
        </div>
      </div>`;
  },

  /* ── Ещё ───────────────────────────────────────────────── */
  more: () => `
    <div class="more-screen">
      <div class="screen-header"><h2 class="screen-title">Ещё</h2></div>
      <div class="screen-content">
        <div class="section-card">
          <div class="more-item" data-action="navigate" data-screen="house">
            <span class="more-item-icon">${MORE_ICONS.house}</span>
            <span class="more-item-label">О домике</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="bikes">
            <span class="more-item-icon">${MORE_ICONS.bikes}</span>
            <span class="more-item-label">Велосипеды и SUP</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="nearby">
            <span class="more-item-icon">${MORE_ICONS.nearby}</span>
            <span class="more-item-label">Что рядом</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="instructions">
            <span class="more-item-icon">${MORE_ICONS.instructions}</span>
            <span class="more-item-label">Инструкции</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="contact">
            <span class="more-item-icon">${MORE_ICONS.contact}</span>
            <span class="more-item-label">Связаться с хозяином</span>
            <span class="more-item-arrow">›</span>
          </div>
        </div>
      </div>
    </div>`,

  /* ── Шаг 1: предложение бани (после бронирования домика) ── */
  upsellSauna: () => {
    const { house } = state.currentOrder;
    const nights = house?.nights || 0;
    const saunaPrice = calcSaunaPerDay(nights);
    const saunaLabel = nights > 1
      ? `${fmtPrice(APP_DATA.sauna.pricePerDay)} 1-я ночь · ${fmtPrice(APP_DATA.sauna.pricePerDayExtra)} × ${nights - 1} след.`
      : `${fmtPrice(APP_DATA.sauna.pricePerDay)} за ночь`;

    return `
      <div class="upsell-screen">
        <div class="screen-header">
          <h2 class="screen-title">К поездке</h2>
          <div class="upsell-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 4 6 4 9c0 4.5 3.5 8 8 8s8-3.5 8-8c0-3-2.5-7-8-7z"/><path d="M8 17v3m4-3v3m4-3v3"/><path d="M5 20h14"/></svg>
          </div>
        </div>
        <div class="screen-content">
          <p class="upsell-step">Шаг 1 из 2</p>
          <p class="upsell-invite">Хотите добавить баню?</p>
          <div class="upsell-day-price section-card">
            <div class="udp-row">
              <span>${saunaLabel}</span>
              <span>${fmtPrice(saunaPrice)}</span>
            </div>
            <div class="udp-note">На всё время вашего пребывания · до ${APP_DATA.sauna.capacity} чел.</div>
          </div>
          <button class="btn-primary" data-action="addSaunaToOrder">
            Добавить баню — ${fmtPrice(saunaPrice)}
          </button>
          <button class="btn-outline upsell-skip" data-action="skipToUpsellBikes">
            Нет, спасибо
          </button>
        </div>
      </div>`;
  },

  /* ── Шаг 2: предложение велосипедов ────────────────────── */
  upsellBikes: () => {
    const inBookingFlow = state.bookingFlow;
    const { house, sauna } = state.currentOrder;
    const prevTotal = (house?.price || 0) + (sauna?.price || 0);

    const priceBlock = prevTotal > 0 ? `
      <div class="section-card price-block">
        ${house ? `
        <div class="price-row">
          <span>${house.saunaIncluded ? 'Домик + баня' : 'Домик'}</span>
          <span>${fmtPrice(house.price)}</span>
        </div>` : ''}
        ${sauna && !house?.saunaIncluded ? `
        <div class="price-row">
          <span>Баня</span>
          <span>${fmtPrice(sauna.price)}</span>
        </div>` : ''}
        <div class="price-row total">
          <span>Без велосипедов</span>
          <span>${fmtPrice(prevTotal)}</span>
        </div>
      </div>` : '';

    const submitLabel = prevTotal > 0
      ? `Отправить заявку · ${fmtPrice(prevTotal)}`
      : 'Отправить заявку';

    return `
      <div class="upsell-screen">
        <div class="screen-header"><h2 class="screen-title">К поездке</h2></div>
        <div class="screen-content">
          ${inBookingFlow ? '<p class="upsell-step">Шаг 2 из 2</p>' : ''}
          <p class="upsell-invite">Хотите велосипеды?</p>
          <div class="upsell-card" data-action="navigate" data-screen="bikes">
            <div class="upsell-body">
              <div class="upsell-name">Велосипеды и SUP</div>
              <div class="upsell-meta">${APP_DATA.bikes.priceDay.toLocaleString('ru-RU')} ₽/вел. · SUP ${APP_DATA.sup.priceDay} ₽/сут. · ${APP_DATA.bikes.available} велика</div>
            </div>
            <span class="upsell-arrow">›</span>
          </div>
          ${priceBlock}
          <div class="section-card">
            <label class="comment-label">Есть вопрос или пожелание? <span class="optional">(необязательно)</span></label>
            <textarea class="comment-input" id="order-comment"
              placeholder="Напишите хозяину — любой вопрос или уточнение по брони">${state.orderComment}</textarea>
          </div>
          <button class="btn-primary upsell-submit" data-action="finalSubmit">
            ${submitLabel}
          </button>
        </div>
      </div>`;
  },

  /* ── Экран успеха ──────────────────────────────────────── */
  success: (params = {}) => {
    const map = {
      booking: {
        icon:  '🏠',
        title: 'Заявка отправлена!',
        note:  'В ближайший час хозяин свяжется с вами. Уведомление придёт в Telegram.',
      },
      sauna: {
        icon:  '🔥',
        title: 'Заявка отправлена!',
        note:  'Домик в эту заявку не включён. Подтверждение придёт в Telegram.',
      },
      bikes: {
        icon:  '🚴',
        title: 'Велосипеды заказаны!',
        note:  'Заберите у хозяина при заезде. Напоминание придёт за день.',
      },
    };

    const t = map[params.type] || map.booking;
    const { house, sauna, bikes } = state.currentOrder || {};

    // Build order items
    const items = [];
    if (house) {
      const g = house.guests;
      const gLabel = g === 1 ? 'человек' : g < 5 ? 'человека' : 'человек';
      items.push({
        icon:  '🏠',
        name:  house.saunaIncluded ? 'Домик + баня' : 'Домик',
        meta:  `${dateLabel(house.checkIn)} – ${dateLabel(house.checkOut)} · ${house.nights} ${nightLabel(house.nights)} · ${g} ${gLabel}`,
        price: fmtPrice(house.price),
      });
    }
    if (sauna) {
      let meta;
      if (sauna.perDay) {
        meta = `${sauna.nights} ${nightLabel(sauna.nights)} · весь день`;
      } else {
        const [h] = sauna.slot.split(':').map(Number);
        const endT = `${pad(Math.min(h + sauna.duration, 22))}:00`;
        meta = `${dateLabel(sauna.date)} · ${sauna.slot}–${endT}`;
      }
      items.push({ icon: '🛁', name: 'Баня', meta, price: fmtPrice(sauna.price) });
    }
    if (bikes) {
      const bikeName = bikes.count > 0 && bikes.sup > 0 ? 'Велосипеды + SUP'
        : bikes.sup > 0 ? 'SUP-борд'
        : 'Велосипеды';
      const bikeMeta = [
        bikes.count > 0 ? `${bikes.count} вел.` : null,
        bikes.sup > 0   ? `${bikes.sup} SUP`    : null,
        'весь день',
      ].filter(Boolean).join(' · ');
      items.push({
        icon:  '🚴',
        name:  bikeName,
        meta:  bikeMeta,
        price: fmtPrice(bikes.price),
      });
    }

    const saunaExtra = sauna && !house?.saunaIncluded ? sauna.price : 0;
    const total = (house?.price || 0) + saunaExtra + (bikes?.price || 0);

    const orderCard = items.length ? `
      <div class="order-card">
        <div class="order-card-title">Ваша заявка</div>
        ${items.map(it => `
          <div class="order-item">
            <div class="order-item-body">
              <div class="order-item-name">${it.name}</div>
              <div class="order-item-meta">${it.meta}</div>
            </div>
            <span class="order-item-price">${it.price}</span>
          </div>`).join('')}
        ${items.length > 1 ? `
        <div class="order-total-row">
          <span>Итого</span>
          <span>${fmtPrice(total)}</span>
        </div>` : ''}
      </div>` : '';

    return `
      <div class="success-screen">
        <div class="success-icon"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg></div>
        <h2 class="success-title">${t.title}</h2>
        <div class="order-status-chip">Ожидает подтверждения</div>
        ${orderCard}
        <p class="success-note">${t.note}</p>
        <button class="btn-primary success-btn" data-action="goHome">На главную</button>
      </div>`;
  },
};

/* ═══ КНОПКИ TELEGRAM ДЛЯ КАЖДОГО ЭКРАНА ════════════════════ */

function setupScreenButtons(screenId, params) {
  switch (screenId) {
    case 'home':
    case 'more':
      hideMainButton();
      break;

    case 'house':
      setMainButton('Забронировать', () => router.navigate('booking'));
      break;

    case 'booking': {
      const price         = calcBooking();
      const ok            = !!(state.booking.checkIn && state.booking.checkOut);
      const preSauna      = state.currentOrder?.sauna?.perDay && price && !price.saunaTotal;
      const preSaunaPrice = preSauna ? state.currentOrder.sauna.price : 0;
      const displayTotal  = price ? price.total + preSaunaPrice : 0;
      const txt           = price ? `Отправить заявку · ${fmtPrice(displayTotal)}` : 'Выберите даты';
      setMainButton(txt, submitBooking, ok);
      break;
    }

    case 'sauna': {
      const { checkIn, checkOut } = state.booking;
      const hasHouseDates = checkIn && checkOut && !state.sauna.standaloneOverride;
      if (hasHouseDates) {
        const nights     = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
        const saunaPrice = calcSaunaPerDay(nights);
        const alreadyAdded = state.currentOrder?.sauna?.perDay;
        if (!alreadyAdded) {
          setMainButton(`Добавить к брони · ${fmtPrice(saunaPrice)}`, () => actions.addSaunaPreBooking());
        } else {
          hideMainButton();
        }
      } else {
        const ok  = !!(state.sauna.date && state.sauna.slot);
        const txt = ok ? `Забронировать баню · ${fmtPrice(calcSauna())}` : 'Выберите дату и слот';
        setMainButton(txt, submitSauna, ok);
      }
      break;
    }

    case 'bikes': {
      const bikesTotal = calcBikes();
      const prevTotal  = (state.currentOrder?.house?.price || 0) + (state.currentOrder?.sauna?.price || 0);
      const grandTotal = prevTotal + bikesTotal;
      const inFlow     = state.bookingFlow;
      const hasItems   = state.bikes.count > 0 || state.bikes.sup > 0;
      const txt = inFlow
        ? `Завершить · ${fmtPrice(grandTotal)}`
        : (hasItems ? `Забронировать · ${fmtPrice(bikesTotal)}` : 'Выберите велосипед или SUP');
      setMainButton(txt, submitBikes, inFlow || hasItems);
      break;
    }

    case 'upsellSauna':
    case 'upsellBikes':
      hideMainButton();
      break;

    case 'success':
      setMainButton('На главную', () => router.reset());
      break;

    default:
      hideMainButton();
  }
}

/* ═══ ХУКИ ПОСЛЕ РЕНДЕРА ════════════════════════════════════ */

function afterRender(screenId) {
  if (screenId === 'house' || screenId === 'sauna') setupGallery();
  if (screenId === 'booking') setupCommentSync();
}

function renderSaunaGallery() {
  const imgs = APP_DATA.sauna.gallery;
  return `
    <div class="gallery-wrap">
      <div class="gallery" id="gallery">
        ${imgs.map(src => `<div class="gallery-item" style="background-image:url('${src}');background-size:cover;background-position:center"></div>`).join('')}
      </div>
      <div class="gallery-dots" id="gallery-dots">
        ${imgs.map((_, i) => `<div class="dot${i === 0 ? ' active' : ''}"></div>`).join('')}
      </div>
    </div>`;
}

function setupGallery() {
  const gallery = document.getElementById('gallery');
  const dots    = document.querySelectorAll('#gallery-dots .dot');
  if (!gallery || !dots.length) return;

  gallery.addEventListener('scroll', () => {
    const idx = Math.round(gallery.scrollLeft / gallery.clientWidth);
    dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
  }, { passive: true });

  let isDragging = false, startX = 0, startLeft = 0;

  gallery.addEventListener('mousedown', e => {
    isDragging = true;
    startX = e.pageX;
    startLeft = gallery.scrollLeft;
    gallery.style.cursor = 'grabbing';
    gallery.style.scrollSnapType = 'none';
  });

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    gallery.style.cursor = '';
    gallery.style.scrollSnapType = 'x mandatory';
    const idx = Math.round(gallery.scrollLeft / gallery.clientWidth);
    gallery.scrollTo({ left: idx * gallery.clientWidth, behavior: 'smooth' });
  };

  gallery.addEventListener('mouseup', endDrag);
  gallery.addEventListener('mouseleave', endDrag);
  gallery.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    gallery.scrollLeft = startLeft - (e.pageX - startX);
  });
}

function setupCommentSync() {
  const ta = document.getElementById('booking-comment');
  if (ta) ta.addEventListener('input', () => { state.booking.comment = ta.value; });
}

/* ═══ САБМИТЫ ═══════════════════════════════════════════════ */

function notifyOwner(order, comment) {
  fetch('/.netlify/functions/send-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order, comment, user: tg?.initDataUnsafe?.user || null }),
  }).catch(() => {});
}

function submitBooking() {
  const ta = document.getElementById('booking-comment');
  if (ta) state.booking.comment = ta.value;
  const price    = calcBooking();
  const preSauna = state.currentOrder?.sauna?.perDay && !price?.saunaTotal ? state.currentOrder.sauna : null;
  state.currentOrder = {
    house: price ? {
      checkIn:       state.booking.checkIn,
      checkOut:      state.booking.checkOut,
      nights:        price.nights,
      guests:        state.booking.guests,
      price:         price.total,
      saunaIncluded: price.saunaTotal > 0,
    } : null,
    sauna: preSauna,
    bikes: null,
  };
  state.bookingFlow = true;
  hapticNotify('success');
  router.stack = [{ id: 'home', params: {} }];
  router.navigate(preSauna ? 'upsellBikes' : 'upsellSauna');
}

function submitSauna() {
  if (!state.sauna.date || !state.sauna.slot) return;
  const ta = document.getElementById('sauna-comment');
  if (ta) state.sauna.comment = ta.value;
  const saunaData = {
    date:     state.sauna.date,
    slot:     state.sauna.slot,
    duration: state.sauna.duration,
    price:    calcSauna(),
  };
  if (state.bookingFlow) {
    state.currentOrder.sauna = saunaData;
  } else {
    state.currentOrder = { house: null, sauna: saunaData, bikes: null };
  }
  hapticNotify('success');
  router.stack = [{ id: 'home', params: {} }];
  router.navigate('upsellBikes');
}

function submitBikes() {
  const ta = document.getElementById('bikes-comment');
  if (ta) state.bikes.comment = ta.value;
  const hasBikes = state.bikes.count > 0 || state.bikes.sup > 0;
  if (!hasBikes && !state.bookingFlow && !state.currentOrder.sauna) return;
  hapticNotify('success');
  const type = state.bookingFlow ? 'booking' : (state.currentOrder.sauna ? 'sauna' : 'bikes');
  const bikesData = hasBikes ? { count: state.bikes.count, sup: state.bikes.sup, price: calcBikes() } : null;
  if (state.bookingFlow || state.currentOrder.sauna) {
    state.currentOrder.bikes = bikesData;
  } else {
    state.currentOrder = { house: null, sauna: null, bikes: bikesData };
    notifyOwner(state.currentOrder, state.bikes.comment);
  }
  state.bookingFlow = false;
  resetFormState();
  router.stack = [{ id: 'home', params: {} }];
  router.navigate('success', { type });
}

function resetFormState() {
  state.booking     = { checkIn: null, checkOut: null, guests: 2, comment: '' };
  state.sauna       = { date: null, slot: null, duration: 3, comment: '', standaloneOverride: false, broom: false };
  state.bikes       = { count: 1, sup: 0, duration: '2h', comment: '' };
  state.cal         = { year: new Date().getFullYear(), month: new Date().getMonth() };
  state.orderComment = '';
}

/* ═══ ОБНОВЛЕНИЯ UI БЕЗ ПОЛНОГО РЕБИЛДА ЭКРАНА ══════════════ */

function refreshCalSection() {
  const el = document.querySelector('.cal-section');
  if (el) el.innerHTML = renderCalendar();
}

function refreshSelectedDates() {
  const { checkIn, checkOut } = state.booking;
  const content = document.querySelector('.screen-content');
  if (!content) return;

  let el = content.querySelector('.selected-dates');

  if (!checkIn) { el?.remove(); return; }

  const html = `
    <div class="selected-dates">
      <div class="sel-date-item">
        <span class="sel-label">Заезд</span>
        <span class="sel-value">${dateLabel(checkIn)}</span>
      </div>
      <div class="sel-date-divider">→</div>
      <div class="sel-date-item">
        <span class="sel-label">Выезд</span>
        <span class="sel-value">${checkOut ? dateLabel(checkOut) : '—'}</span>
      </div>
    </div>`;

  if (el) { el.outerHTML = html; }
  else {
    const calSec = content.querySelector('.cal-section');
    calSec?.insertAdjacentHTML('afterend', html);
  }
}

function refreshBookingPrice() {
  const { checkIn, checkOut } = state.booking;
  const price         = calcBooking();
  const preSauna      = state.currentOrder?.sauna?.perDay && price && !price.saunaTotal;
  const preSaunaPrice = preSauna ? state.currentOrder.sauna.price : 0;
  const displayTotal  = price ? price.total + preSaunaPrice : 0;
  const content = document.querySelector('.screen-content');
  if (!content) return;

  let el = content.querySelector('.price-block');

  if (price) {
    const html = `
      <div class="section-card price-block">
        <div class="price-row">
          <span>${price.nights} ${nightLabel(price.nights)} × стоимость</span>
          <span>${fmtPrice(price.nightsTotal)}</span>
        </div>
        ${preSauna ? `
        <div class="price-row">
          <span>Баня <span class="remove-item" data-action="removeSaunaPreBooking">✕ убрать</span></span>
          <span>${fmtPrice(preSaunaPrice)}</span>
        </div>` : ''}
        <div class="price-row total">
          <span>Итого</span><span>${fmtPrice(displayTotal)}</span>
        </div>
      </div>`;
    if (el) { el.outerHTML = html; }
    else {
      const selDates = content.querySelector('.selected-dates');
      selDates?.insertAdjacentHTML('afterend', html);
    }
  } else {
    el?.remove();
  }

  const ok  = !!(checkIn && checkOut);
  const txt = price ? `Отправить заявку · ${fmtPrice(displayTotal)}` : 'Выберите даты';
  setMainButton(txt, submitBooking, ok);
  const btn = document.getElementById('booking-submit-btn');
  if (btn) { btn.textContent = txt; btn.disabled = !ok; }
}

function refreshSaunaSlots() {
  const sCards = document.querySelectorAll('.section-card');
  if (sCards[1]) {
    const existing = sCards[1].querySelector('.slot-grid, .no-date-hint');
    if (existing) existing.outerHTML = renderSlotGrid(state.sauna.date);
    const title = sCards[1].querySelector('.section-title');
    if (title) title.textContent = `Доступные слоты${state.sauna.date ? ' — ' + dateLabel(state.sauna.date) : ''}`;
  }
}

function refreshSaunaSummary() {
  const { date, slot, duration } = state.sauna;
  const wrap = document.querySelector('.booking-summary, .hint-block');
  if (!wrap) return;

  if (slot) {
    const [h] = slot.split(':').map(Number);
    const endT = `${pad(Math.min(h+duration, 22))}:00`;
    wrap.outerHTML = `
      <div class="booking-summary">
        <div class="summary-row"><span>🗓 ${dateLabel(date)}</span></div>
        <div class="summary-row">
          <span>⏱ ${slot} — ${endT}</span>
          <span class="summary-price">${fmtPrice(calcSauna())}</span>
        </div>
      </div>`;
  } else {
    const existing = document.querySelector('.booking-summary');
    if (existing) existing.outerHTML = `<div class="hint-block">Выберите дату и слот для бронирования</div>`;
  }

  const ok  = !!(date && slot);
  const txt = ok ? `Забронировать баню · ${fmtPrice(calcSauna())}` : 'Выберите дату и слот';
  setMainButton(txt, submitSauna, ok);
  const btn = document.getElementById('sauna-submit-btn');
  if (btn) { btn.textContent = txt; btn.disabled = !ok; }
}

function refreshBikesSummary() {
  const { count, sup } = state.bikes;
  const inFlow     = state.bookingFlow;
  const bikesTotal = calcBikes();
  const prevTotal  = (state.currentOrder?.house?.price || 0) + (state.currentOrder?.sauna?.price || 0);
  const grandTotal = prevTotal + bikesTotal;
  const hasItems   = count > 0 || sup > 0;

  const lbl = document.getElementById('bike-sum-label');
  const pr  = document.getElementById('bike-sum-price');
  if (lbl) {
    lbl.textContent = `${count} велосипед${count>1?'а':''} · весь день`;
    lbl.closest('.summary-row').style.display = count > 0 ? '' : 'none';
  }
  if (pr)  pr.textContent  = fmtPrice(APP_DATA.bikes.priceDay * count);

  const supRow = document.getElementById('sup-sum-row');
  const supLbl = document.getElementById('sup-sum-label');
  const supPr  = document.getElementById('sup-sum-price');
  if (supRow) supRow.style.display = sup > 0 ? '' : 'none';
  if (supLbl) supLbl.textContent = `${sup} SUP · весь день`;
  if (supPr)  supPr.textContent  = fmtPrice(APP_DATA.sup.priceDay * sup);

  const supCountEl = document.querySelector('.counter-value-sup');
  if (supCountEl) supCountEl.textContent = sup;

  const grandEl = document.getElementById('bikes-grand-total');
  if (grandEl) {
    const span = grandEl.querySelector('span:last-child');
    if (span) span.textContent = fmtPrice(grandTotal);
  }

  const btnLabel = inFlow
    ? `Завершить бронирование · ${fmtPrice(grandTotal)}`
    : (hasItems ? `Забронировать · ${fmtPrice(bikesTotal)}` : 'Выберите велосипед или SUP');
  const btn = document.getElementById('bikes-submit-btn');
  if (btn) { btn.textContent = btnLabel; btn.disabled = !inFlow && !hasItems; }

  setMainButton(btnLabel, submitBikes, inFlow || hasItems);
}

/* ═══ ДЕЛЕГИРОВАНИЕ СОБЫТИЙ ══════════════════════════════════ */

const actions = {
  navigate({ screen, action, ...params }) {
    haptic('light');
    router.navigate(screen, params);
  },

  submitBooking() {
    submitBooking();
  },

  submitSauna() {
    submitSauna();
  },

  submitBikes() {
    submitBikes();
  },

  skipToUpsellBikes() {
    haptic('light');
    router.navigate('upsellBikes');
  },

  addSaunaToOrder() {
    haptic('medium');
    const { nights } = state.currentOrder.house;
    state.currentOrder.sauna = {
      perDay:   true,
      nights,
      price:    calcSaunaPerDay(nights),
      date:     null,
      slot:     null,
      duration: null,
    };
    router.navigate('upsellBikes');
  },

  addSaunaPreBooking() {
    haptic('medium');
    const { checkIn, checkOut } = state.booking;
    const nights     = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
    const ta = document.getElementById('sauna-comment');
    if (ta) state.sauna.comment = ta.value;
    state.currentOrder = { ...state.currentOrder, sauna: {
      perDay: true, nights,
      price:  calcSaunaPerDay(nights),
      date: null, slot: null, duration: null,
    }};
    router.navigate('booking');
  },

  removeSaunaPreBooking() {
    haptic('light');
    state.currentOrder = { ...state.currentOrder, sauna: null };
    const cur = router.stack[router.stack.length - 1];
    if (cur?.id === 'booking') {
      refreshBookingPrice();
    } else {
      router._render(cur.id, cur.params || {}, 'fade');
    }
  },

  switchToStandaloneMode() {
    haptic('light');
    state.sauna.standaloneOverride = true;
    const cur = router.stack[router.stack.length - 1];
    router._render(cur.id, cur.params || {}, 'fade');
  },

  finalSubmit() {
    const ta = document.getElementById('order-comment');
    if (ta) state.orderComment = ta.value;
    notifyOwner(state.currentOrder, state.orderComment);
    hapticNotify('success');
    const type = state.bookingFlow ? 'booking' : 'sauna';
    state.bookingFlow = false;
    resetFormState();
    router.stack = [{ id: 'home', params: {} }];
    router.navigate('success', { type });
  },

  goHome() {
    router.reset();
  },

  goBack() {
    haptic('light');
    router.back();
  },

  /* Бронирование: выбор даты */
  pickDate({ date }) {
    haptic('light');
    state.sauna.standaloneOverride = false;
    const { checkIn, checkOut } = state.booking;

    if (!checkIn || (checkIn && checkOut)) {
      state.booking.checkIn  = date;
      state.booking.checkOut = null;
    } else if (date > checkIn) {
      // Проверяем, нет ли занятых дат в диапазоне
      let conflict = false;
      const from = new Date(checkIn);
      const to   = new Date(date);
      for (let d = new Date(from); d < to; d.setDate(d.getDate()+1)) {
        const ds = fmtDate(d.getFullYear(), d.getMonth()+1, d.getDate());
        if (APP_DATA.unavailableDates.includes(ds)) { conflict = true; break; }
      }
      if (conflict) {
        state.booking.checkIn  = date;
        state.booking.checkOut = null;
      } else {
        state.booking.checkOut = date;
      }
    } else {
      state.booking.checkIn  = date;
      state.booking.checkOut = null;
    }

    refreshCalSection();
    refreshSelectedDates();
    refreshBookingPrice();
  },

  calPrev() {
    let { year, month } = state.cal;
    const today = new Date();
    month--;
    if (month < 0) { month = 11; year--; }
    if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth())) return;
    state.cal = { year, month };
    refreshCalSection();
  },

  calNext() {
    let { year, month } = state.cal;
    month++;
    if (month > 11) { month = 0; year++; }
    state.cal = { year, month };
    refreshCalSection();
  },

  changeGuests({ delta }) {
    const max = APP_DATA.house.capacity;
    const nv  = Math.max(1, Math.min(max, state.booking.guests + parseInt(delta)));
    if (nv === state.booking.guests) return;
    state.booking.guests = nv;
    haptic('light');
    const el = document.querySelector('.counter-value');
    if (el) el.textContent = `${nv} ${nv===1?'человек':nv<5?'человека':'человек'}`;
    if (state.booking.checkIn && state.booking.checkOut) refreshBookingPrice();
  },

  /* Баня: выбор даты */
  selectSaunaDate({ date }) {
    haptic('light');
    state.sauna.date = date;
    state.sauna.slot = null;

    document.querySelectorAll('.date-chip').forEach(el =>
      el.classList.toggle('selected', el.dataset.date === date));

    refreshSaunaSlots();
    refreshSaunaSummary();
  },

  /* Баня: выбор слота */
  selectSlot({ slot }) {
    haptic('medium');
    state.sauna.slot = slot;

    const { duration } = state.sauna;
    document.querySelectorAll('.slot-chip:not(.booked)').forEach(el => {
      const isSel = el.dataset.slot === slot;
      el.classList.toggle('selected', isSel);
      const lbl = el.querySelector('.slot-label');
      if (lbl) {
        if (isSel) {
          const [h] = slot.split(':').map(Number);
          lbl.textContent = `до ${pad(Math.min(h+duration,22))}:00`;
        } else {
          lbl.textContent = 'Своб.';
        }
      }
    });

    refreshSaunaSummary();
  },

  /* Баня: длительность */
  selectDuration({ duration }) {
    state.sauna.duration = parseInt(duration);
    document.querySelectorAll('[data-action="selectDuration"]').forEach(el =>
      el.classList.toggle('selected', parseInt(el.dataset.duration) === state.sauna.duration));
    refreshSaunaSummary();
  },

  /* Велосипеды: количество */
  changeBikeCount({ delta }) {
    const max = APP_DATA.bikes.available;
    const nv  = Math.max(1, Math.min(max, state.bikes.count + parseInt(delta)));
    if (nv === state.bikes.count) return;
    state.bikes.count = nv;
    haptic('light');
    const el = document.querySelector('.counter-value');
    if (el) el.textContent = nv;
    refreshBikesSummary();
  },

  /* SUP: количество */
  changeSUPCount({ delta }) {
    const max = APP_DATA.sup.available;
    const nv  = Math.max(0, Math.min(max, state.bikes.sup + parseInt(delta)));
    if (nv === state.bikes.sup) return;
    state.bikes.sup = nv;
    haptic('light');
    refreshBikesSummary();
  },

  /* Баня: веник */
  toggleSaunaBroom({ broom }) {
    state.sauna.broom = broom === '1';
    document.querySelectorAll('[data-action="toggleSaunaBroom"]').forEach(el =>
      el.classList.toggle('selected', el.dataset.broom === broom));
    refreshSaunaSummary();
  },

  /* Велосипеды: длительность */
  selectBikeDuration({ duration }) {
    state.bikes.duration = duration;
    document.querySelectorAll('.duration-chip').forEach(el =>
      el.classList.toggle('selected', el.dataset.duration === duration));
    refreshBikesSummary();
  },

  /* Что рядом: вкладка */
  setNearbyTab({ tab }) {
    state.nearby.tab = tab;
    document.querySelectorAll('.tab-item').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tab));

    const places = APP_DATA.nearby[tab] || [];
    const list   = document.querySelector('.places-list');
    if (list) list.innerHTML = places.map(p => `
      <div class="place-card">
        <div class="place-info">
          <div class="place-name">${p.name}</div>
          <div class="place-desc">${p.desc}</div>
          <div class="place-meta">
            <span class="place-dist">${p.distance}</span>
            <span class="place-time">${p.time}</span>
          </div>
        </div>
        ${p.mapsUrl ? `<div class="place-action" data-action="openLink" data-url="${p.mapsUrl}">›</div>` : ''}
      </div>`).join('');
  },

  /* Аккордеон */
  toggleAcc({ id }) {
    const content = document.getElementById(`ac-${id}`);
    if (!content) return;

    const isOpen = content.classList.contains('open');

    // Закрыть все
    document.querySelectorAll('.accordion-content.open').forEach(el => {
      el.classList.remove('open');
      el.parentElement?.querySelector('.accordion-arrow')?.classList.remove('rotated');
    });

    if (!isOpen) {
      content.classList.add('open');
      content.parentElement?.querySelector('.accordion-arrow')?.classList.add('rotated');
    }
  },

  /* Копирование пароля Wi-Fi */
  copyWifi() {
    const txt = document.getElementById('wifi-pass')?.textContent || 'nature2024';
    navigator.clipboard?.writeText(txt).then(() => {
      hapticNotify('success');
      const btn = document.querySelector('.btn-copy');
      if (btn) {
        btn.textContent = 'Скопировано ✓';
        btn.style.color = 'var(--accent)';
        setTimeout(() => { btn.textContent = 'Скопировать'; btn.style.color = ''; }, 2000);
      }
    });
  },

  /* Открыть внешнюю ссылку */
  openLink({ url }) {
    if (!url) return;
    if (tg) tg.openLink(url);
    else window.open(url, '_blank', 'noopener');
  },

  startApp() {
    localStorage.setItem('repka_onboarded', '1');
    haptic('light');
    router.reset();
    const pending = sessionStorage.getItem('repka_pending_route');
    if (pending) {
      sessionStorage.removeItem('repka_pending_route');
      const route = START_ROUTES[pending];
      if (route) { router.navigate(route); return; }
    }
  },

  share() {
    haptic('light');
    const url = 'https://t.me/repka_domik_bot';
    const text = 'Репка. Домик в роще — 63 км от Москвы';
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
      navigator.share({ title: 'Репка. Домик в роще.', text, url });
    } else {
      navigator.clipboard?.writeText(`${text}\n${url}`);
    }
  },

};

/* ═══ ДЕЛЕГИРОВАНИЕ КЛИКОВ ═══════════════════════════════════ */

function setupEvents() {
  document.getElementById('app').addEventListener('click', e => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();

    const action = target.dataset.action;
    const handler = actions[action];
    if (handler) handler({ ...target.dataset });
  }, true);
}

/* ═══ СТАРТ ═════════════════════════════════════════════════ */

function getStartParam() {
  return tg?.initDataUnsafe?.start_param
    || new URLSearchParams(location.search).get('startapp')
    || null;
}

const START_ROUTES = {
  booking: 'booking',
  book:    'booking',
  sauna:   'sauna',
  contact: 'contact',
  баня:    'sauna',
  домик:   'booking',
};

document.addEventListener('DOMContentLoaded', () => {
  initTelegram();
  setupEvents();
  renderTabBar();

  const param = getStartParam();

  if (!localStorage.getItem('repka_onboarded')) {
    router.stack = [{ id: 'onboarding', params: {} }];
    router._render('onboarding', {}, 'fade');
    // save param so startApp() can use it after onboarding
    if (param) sessionStorage.setItem('repka_pending_route', param);
  } else {
    router.reset();
    const route = START_ROUTES[param];
    if (route) router.navigate(route);
  }
});

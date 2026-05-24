/* ═══════════════════════════════════════════════════════════
   app.js — логика приложения
   Роутер, экраны, компоненты, обработчики событий.
   ═══════════════════════════════════════════════════════════ */

/* ═══ СОСТОЯНИЕ ═══════════════════════════════════════════ */

const state = {
  booking:      { checkIn: null, checkOut: null, guests: 2, comment: '' },
  sauna:        { date: null, slot: null, duration: 2 },
  bikes:        { count: 1, duration: '2h' },
  cal:          { year: new Date().getFullYear(), month: new Date().getMonth() },
  nearby:       { tab: 'Природа' },
  success:      { type: 'booking' },
  bookingFlow:  false, // true when sauna/bikes upsell is part of a house booking
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
  booking: 'booking',
  sauna: 'sauna',
  more: 'more', bikes: 'more', nearby: 'more', instructions: 'more', contact: 'more',
};

function renderTabBar() {
  const nav = document.createElement('nav');
  nav.id = 'tab-bar';
  nav.innerHTML = [
    { id: 'home',    icon: '🏠', label: 'Домик'      },
    { id: 'booking', icon: '📅', label: 'Бронировать' },
    { id: 'sauna',   icon: '🔥', label: 'Баня'        },
    { id: 'more',    icon: '⊞',  label: 'Ещё'         },
  ].map(t => `
    <button class="tab-btn" data-tab="${t.id}">
      <span class="tab-btn-icon">${t.icon}</span>
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
  return dow === 0 || dow === 5 || dow === 6; // пт сб вс
}

function calcBooking() {
  const { checkIn, checkOut, guests } = state.booking;
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
  const cleaning = APP_DATA.house.cleaning;
  const saunaTotal = guests > APP_DATA.house.capacity
    ? nights * APP_DATA.sauna.minDuration * APP_DATA.sauna.pricePerHour
    : 0;
  return { nights, nightsTotal, cleaning, saunaTotal, total: nightsTotal + cleaning + saunaTotal };
}

function calcSauna() {
  return APP_DATA.sauna.pricePerHour * state.sauna.duration;
}

function calcBikes() {
  return APP_DATA.bikes.priceDay * state.bikes.count;
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
    const greeting = name ? `Привет, ${name}! 👋` : 'Привет! 👋';

    return `
      <div class="onboarding-screen">
        <div class="onboarding-hero"></div>
        <div class="onboarding-content">
          <div class="onboarding-emoji">🏕️</div>
          <h1 class="onboarding-title">${greeting}</h1>
          <p class="onboarding-sub">Это приложение для бронирования A-frame домика в берёзовой роще у Канала&nbsp;им.&nbsp;Москвы.</p>
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
        <div class="hero-content">
          <div class="hero-badge">Дмитровский район · 82 км от Москвы</div>
          <h1 class="hero-title">A-frame<br>домик</h1>
          <p class="hero-sub">Сосновый лес · Баня · Канал</p>
        </div>
      </div>

      <div class="home-content">
        <div class="avail-chip">
          <span class="avail-dot"></span>
          Свободно: 26–28 июня (выходные)
        </div>

        <div class="home-info-card" data-action="navigate" data-screen="house">
          <div class="home-info-row">
            <span class="home-info-label">Цена</span>
            <span class="home-info-value">от ${fmtPrice(d.priceWeekday)}/ночь</span>
          </div>
          <div class="home-info-row">
            <span class="home-info-label">Гости</span>
            <span class="home-info-value">до ${APP_DATA.sauna.capacity} человек</span>
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
          <span>🔗 Поделиться с другом</span>
          <span class="arrow">›</span>
        </div>
      </div>
    </div>`;
  },

  /* ── Домик ─────────────────────────────────────────────── */
  house: () => {
    const d = APP_DATA.house;
    const gallery = d.gallery.map(item => `
      <div class="gallery-item" style="background:${item.gradient}">
        <div class="gallery-label">${item.label}</div>
      </div>`).join('');

    const amenities = d.amenities.map(a => `
      <div class="amenity-item">
        <span class="amenity-icon">${a.icon}</span>
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
              <p class="house-meta">${d.area} м² · ${d.floors} этажа · до ${APP_DATA.sauna.capacity} гостей</p>
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
                <span class="ci-icon">🔑</span>
                <span class="ci-label">Заезд</span>
                <span class="ci-value">с ${d.checkIn}</span>
              </div>
              <div class="checkin-item">
                <span class="ci-icon">🚪</span>
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

    const priceBlock = price ? `
      <div class="section-card price-block">
        <div class="price-row">
          <span>${price.nights} ${nightLabel(price.nights)} × стоимость</span>
          <span>${fmtPrice(price.nightsTotal)}</span>
        </div>
        <div class="price-row">
          <span>Уборка</span>
          <span>${fmtPrice(price.cleaning)}</span>
        </div>
        ${price.saunaTotal ? `
        <div class="price-row">
          <span>🛁 Баня · мин. ${APP_DATA.sauna.minDuration} ч/день</span>
          <span>${fmtPrice(price.saunaTotal)}</span>
        </div>` : ''}
        <div class="price-row total">
          <span>Итого</span>
          <span>${fmtPrice(price.total)}</span>
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
            <div class="sauna-guests-hint" id="sauna-guests-hint"${guests > APP_DATA.house.capacity ? '' : ' style="display:none"'}>
              🛁 При 5–6 гостях баня включена в стоимость — там +2 места для группы.
            </div>
          </div>

          ${priceBlock}

          <div class="section-card">
            <label class="comment-label">Комментарий <span class="optional">(необязательно)</span></label>
            <textarea class="comment-input" id="booking-comment"
              placeholder="Есть питомец / приедем поздно / нужна кроватка…">${comment}</textarea>
          </div>

          <div class="cancellation-note">
            <span class="cancel-icon">ℹ️</span>
            <span>Отмена за 3 дня и более — бесплатно. Позже — 50% стоимости.</span>
          </div>

          <button class="btn-primary" id="booking-submit-btn"
            data-action="submitBooking"
            ${checkIn && checkOut ? '' : 'disabled'}>
            ${price ? `Отправить заявку · ${fmtPrice(price.total)}` : 'Выберите даты'}
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
    const { date, slot, duration } = state.sauna;
    const price = calcSauna();
    const [h]   = slot ? slot.split(':').map(Number) : [0];
    const endT  = slot ? `${pad(Math.min(h+duration, 22))}:00` : '';

    return `
      <div class="sauna-screen">
        <div class="screen-header"><h2 class="screen-title">Баня</h2></div>

        <div class="sauna-hero">
          <div class="sauna-hero-image"></div>
          <div class="sauna-hero-info">
            ${APP_DATA.sauna.pricePerHour.toLocaleString('ru-RU')} ₽/час · до ${APP_DATA.sauna.capacity} чел. · мин. 2 часа
          </div>
        </div>

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
              ${[2,3,4].map(n => `
                <div class="duration-chip${duration===n?' selected':''}"
                     data-action="selectDuration" data-duration="${n}">${n} часа</div>`).join('')}
            </div>
          </div>

          ${slot
            ? `<div class="booking-summary">
                <div class="summary-row"><span>🗓 ${dateLabel(date)}</span></div>
                <div class="summary-row">
                  <span>⏱ ${slot} — ${endT}</span>
                  <span class="summary-price" id="sauna-price">${fmtPrice(price)}</span>
                </div>
               </div>`
            : `<div class="hint-block">Выберите дату и слот для бронирования</div>`}
        </div>
        <div class="screen-bottom-space"></div>
      </div>`;
  },

  /* ── Велосипеды ────────────────────────────────────────── */
  bikes: () => {
    const { count } = state.bikes;

    return `
      <div class="bikes-screen">
        <div class="screen-header"><h2 class="screen-title">Велосипеды</h2></div>

        <div class="bikes-hero">
          <div class="bikes-hero-image"></div>
          <div class="bikes-hero-info">
            ${APP_DATA.bikes.available} велосипеда · ${APP_DATA.bikes.priceDay} ₽/день
          </div>
        </div>

        <div class="screen-content">
          <div class="section-card">
            <div class="counter-row">
              <div>
                <div class="counter-label">Велосипедов</div>
                <div class="counter-hint">Максимум ${APP_DATA.bikes.available}</div>
              </div>
              <div class="counter">
                <button class="counter-btn" data-action="changeBikeCount" data-delta="-1">−</button>
                <span class="counter-value">${count}</span>
                <button class="counter-btn" data-action="changeBikeCount" data-delta="1">+</button>
              </div>
            </div>
          </div>

          <div class="booking-summary">
            <div class="summary-row">
              <span id="bike-sum-label">${count} велосипед${count>1?'а':''} · весь день</span>
              <span class="summary-price" id="bike-sum-price">${fmtPrice(calcBikes())}</span>
            </div>
          </div>

          <div class="section-card routes-section">
            <h3 class="section-title">Популярные маршруты</h3>
            ${APP_DATA.bikes.routes.map(r => `
              <div class="route-item">
                <span class="route-name">🚴 ${r.name}</span>
                <span class="route-meta">${r.distance} · ${r.time}</span>
              </div>`).join('')}
          </div>

          <div class="cancellation-note">
            <span class="cancel-icon">ℹ️</span>
            <span>Вернуть велосипеды до ${APP_DATA.bikes.returnTime}. Выдаёт хозяин при заезде.</span>
          </div>
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
        <div class="place-icon">${p.icon}</div>
        <div class="place-info">
          <div class="place-name">${p.name}</div>
          <div class="place-desc">${p.desc}</div>
          <div class="place-meta">
            <span class="place-dist">📍 ${p.distance}</span>
            <span class="place-time">🕐 ${p.time}</span>
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
              <div class="map-pin">📍</div>
              <span>A-frame домик</span>
              <span class="map-coords">56.3542, 37.5128</span>
            </div>
          </div>
          <div class="btn-open-maps" data-action="openLink"
               data-url="https://yandex.ru/maps/?pt=37.5128,56.3542&z=14">
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
                <span>${item.title}</span>
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
              <span class="contact-btn-icon">✉️</span>
              <span class="contact-btn-label">Написать в Telegram</span>
              <span class="contact-btn-arrow">›</span>
            </div>
            <div class="contact-btn" data-action="openLink" data-url="tel:${c.phone}">
              <span class="contact-btn-icon">📞</span>
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
            <span class="more-item-icon">🏠</span>
            <span class="more-item-label">О домике</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="bikes">
            <span class="more-item-icon">🚴</span>
            <span class="more-item-label">Велосипеды</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="nearby">
            <span class="more-item-icon">🗺</span>
            <span class="more-item-label">Что рядом</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="instructions">
            <span class="more-item-icon">📋</span>
            <span class="more-item-label">Инструкции</span>
            <span class="more-item-arrow">›</span>
          </div>
          <div class="more-item" data-action="navigate" data-screen="contact">
            <span class="more-item-icon">✉️</span>
            <span class="more-item-label">Связаться с хозяином</span>
            <span class="more-item-arrow">›</span>
          </div>
        </div>
      </div>
    </div>`,

  /* ── Шаг 1: предложение бани (после бронирования домика) ── */
  upsellSauna: () => {
    const { guests } = state.booking;
    const needsSauna = guests > APP_DATA.house.capacity;
    const price = calcBooking();

    if (needsSauna) {
      return `
        <div class="upsell-screen">
          <div class="screen-header"><h2 class="screen-title">К поездке</h2></div>
          <div class="screen-content">
            <p class="upsell-step">Шаг 1 из 2</p>
            <div class="upsell-required-block">
              <div class="upsell-required-icon">🛁</div>
              <div class="upsell-required-text">
                <strong>Для ${guests} гостей нужна баня</strong><br>
                Домик до 4 человек, баня даёт +2 места.<br>
                Стоимость бани уже учтена в заявке${price?.saunaTotal ? ': ' + fmtPrice(price.saunaTotal) : ''}.
              </div>
            </div>
            <p class="upsell-prompt">Хотите выбрать время прямо сейчас?</p>
            <button class="btn-primary" data-action="navigate" data-screen="sauna">
              🛁 Выбрать время бани
            </button>
            <button class="btn-outline upsell-skip" data-action="skipToUpsellBikes">
              Выберу позже — хозяин поможет
            </button>
          </div>
        </div>`;
    }

    return `
      <div class="upsell-screen">
        <div class="screen-header"><h2 class="screen-title">К поездке</h2></div>
        <div class="screen-content">
          <p class="upsell-step">Шаг 1 из 2</p>
          <p class="upsell-invite">Хотите добавить баню?</p>
          <div class="upsell-card" data-action="navigate" data-screen="sauna">
            <span class="upsell-icon">🛁</span>
            <div class="upsell-body">
              <div class="upsell-name">Баня-домик</div>
              <div class="upsell-meta">${APP_DATA.sauna.pricePerHour.toLocaleString('ru-RU')} ₽/час · мин. 2 ч · до ${APP_DATA.sauna.capacity} чел.</div>
            </div>
            <span class="upsell-arrow">›</span>
          </div>
          <button class="btn-outline upsell-skip" data-action="skipToUpsellBikes">
            Нет, спасибо
          </button>
        </div>
      </div>`;
  },

  /* ── Шаг 2: предложение велосипедов ────────────────────── */
  upsellBikes: () => {
    const inBookingFlow = state.bookingFlow;
    const skipLabel = inBookingFlow ? 'Готово, отправить заявку' : 'Нет, отправить заявку';
    return `
      <div class="upsell-screen">
        <div class="screen-header"><h2 class="screen-title">К поездке</h2></div>
        <div class="screen-content">
          ${inBookingFlow ? '<p class="upsell-step">Шаг 2 из 2</p>' : ''}
          <p class="upsell-invite">Хотите велосипеды?</p>
          <div class="upsell-card" data-action="navigate" data-screen="bikes">
            <span class="upsell-icon">🚴</span>
            <div class="upsell-body">
              <div class="upsell-name">Велосипеды</div>
              <div class="upsell-meta">${APP_DATA.bikes.priceDay.toLocaleString('ru-RU')} ₽/день · ${APP_DATA.bikes.available} велика</div>
            </div>
            <span class="upsell-arrow">›</span>
          </div>
          <button class="btn-primary upsell-submit" data-action="finalSubmit">
            ${skipLabel}
          </button>
        </div>
      </div>`;
  },

  /* ── Экран успеха ──────────────────────────────────────── */
  success: (params = {}) => {
    const map = {
      booking: {
        icon: '🏠',
        title: 'Заявка отправлена!',
        sub:   'В ближайший час хозяин свяжется с вами для подтверждения.',
        note:  'Уведомление придёт в Telegram',
      },
      sauna: {
        icon: '🔥',
        title: 'Баня забронирована!',
        sub:   `${state.sauna.date ? dateLabel(state.sauna.date) : ''} в ${state.sauna.slot || '—'} — ждём вас!`,
        note:  'Домик в эту заявку не включён. Подтверждение придёт в Telegram.',
      },
      bikes: {
        icon: '🚴',
        title: 'Велосипеды заказаны!',
        sub:   'Заберите у хозяина при заезде.',
        note:  'Напоминание придёт за день до приезда',
      },
    };

    const t = map[params.type] || map.booking;

    return `
      <div class="success-screen">
        <div class="success-icon">${t.icon}</div>
        <div class="success-checkmark">✓</div>
        <h2 class="success-title">${t.title}</h2>
        <p class="success-subtitle">${t.sub}</p>
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
      const price = calcBooking();
      const ok    = !!(state.booking.checkIn && state.booking.checkOut);
      const txt   = price ? `Отправить заявку · ${fmtPrice(price.total)}` : 'Выберите даты';
      setMainButton(txt, submitBooking, ok);
      break;
    }

    case 'sauna': {
      const ok  = !!(state.sauna.date && state.sauna.slot);
      const txt = ok ? `Забронировать баню · ${fmtPrice(calcSauna())}` : 'Выберите дату и слот';
      setMainButton(txt, submitSauna, ok);
      break;
    }

    case 'bikes':
      setMainButton(`Забронировать · ${fmtPrice(calcBikes())}`, submitBikes, true);
      break;

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
  if (screenId === 'house')   setupGallery();
  if (screenId === 'booking') setupCommentSync();
}

function setupGallery() {
  const gallery = document.getElementById('gallery');
  const dots    = document.querySelectorAll('#gallery-dots .dot');
  if (!gallery || !dots.length) return;

  gallery.addEventListener('scroll', () => {
    const idx = Math.round(gallery.scrollLeft / gallery.clientWidth);
    dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
  }, { passive: true });
}

function setupCommentSync() {
  const ta = document.getElementById('booking-comment');
  if (ta) ta.addEventListener('input', () => { state.booking.comment = ta.value; });
}

/* ═══ САБМИТЫ ═══════════════════════════════════════════════ */

function submitBooking() {
  const ta = document.getElementById('booking-comment');
  if (ta) state.booking.comment = ta.value;
  state.bookingFlow = true;
  hapticNotify('success');
  router.stack = [{ id: 'home', params: {} }];
  router.navigate('upsellSauna');
}

function submitSauna() {
  if (!state.sauna.date || !state.sauna.slot) return;
  hapticNotify('success');
  router.stack = [{ id: 'home', params: {} }];
  router.navigate('upsellBikes');
}

function submitBikes() {
  hapticNotify('success');
  const type = state.bookingFlow ? 'booking' : 'bikes';
  state.bookingFlow = false;
  router.stack = [{ id: 'home', params: {} }];
  router.navigate('success', { type });
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
  const price   = calcBooking();
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
        <div class="price-row">
          <span>Уборка</span><span>${fmtPrice(price.cleaning)}</span>
        </div>
        ${price.saunaTotal ? `
        <div class="price-row">
          <span>🛁 Баня · мин. ${APP_DATA.sauna.minDuration} ч/день</span>
          <span>${fmtPrice(price.saunaTotal)}</span>
        </div>` : ''}
        <div class="price-row total">
          <span>Итого</span><span>${fmtPrice(price.total)}</span>
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
  const txt = price ? `Отправить заявку · ${fmtPrice(price.total)}` : 'Выберите даты';
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
}

function refreshBikesSummary() {
  const { count } = state.bikes;
  const lbl = document.getElementById('bike-sum-label');
  const pr  = document.getElementById('bike-sum-price');
  if (lbl) lbl.textContent = `${count} велосипед${count>1?'а':''} · весь день`;
  if (pr)  pr.textContent  = fmtPrice(calcBikes());
  setMainButton(`Забронировать · ${fmtPrice(calcBikes())}`, submitBikes, true);
}

/* ═══ ОФФЕР-МОДАЛКА ════════════════════════════════════════ */

const OFFER_KEY = 'repka_offer_shown';

function showOfferModal() {
  if (localStorage.getItem(OFFER_KEY)) return;

  const modal = document.createElement('div');
  modal.id = 'offer-modal';
  modal.className = 'offer-overlay';
  modal.innerHTML = `
    <div class="offer-card">
      <span class="offer-emoji">🎁</span>
      <h2 class="offer-title">Скидка 10% на первое бронирование</h2>
      <p class="offer-subtitle">Подпишитесь на бота — получите промокод сразу в чат</p>
      <ul class="offer-bullets">
        <li>Напомним о заезде за день</li>
        <li>Первыми узнаёте о свободных датах</li>
        <li>Эксклюзивные акции для подписчиков</li>
      </ul>
      <button class="btn-offer" data-action="acceptOffer">Получить скидку 10%</button>
      <button class="offer-skip" data-action="closeOffer">Пропустить</button>
    </div>`;

  document.getElementById('app').appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeOfferModal() {
  localStorage.setItem(OFFER_KEY, '1');
  const modal = document.getElementById('offer-modal');
  if (!modal) return;
  modal.classList.remove('visible');
  modal.addEventListener('transitionend', () => modal.remove(), { once: true });
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

  skipToUpsellBikes() {
    haptic('light');
    router.navigate('upsellBikes');
  },

  finalSubmit() {
    hapticNotify('success');
    const type = state.bookingFlow ? 'booking' : 'sauna';
    state.bookingFlow = false;
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
    const max = APP_DATA.sauna.capacity;
    const nv  = Math.max(1, Math.min(max, state.booking.guests + parseInt(delta)));
    if (nv === state.booking.guests) return;
    state.booking.guests = nv;
    haptic('light');
    const el = document.querySelector('.counter-value');
    if (el) el.textContent = `${nv} ${nv===1?'человек':nv<5?'человека':'человек'}`;
    const hint = document.getElementById('sauna-guests-hint');
    if (hint) hint.style.display = nv > APP_DATA.house.capacity ? '' : 'none';
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
    document.querySelectorAll('.duration-chip').forEach(el =>
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
        <div class="place-icon">${p.icon}</div>
        <div class="place-info">
          <div class="place-name">${p.name}</div>
          <div class="place-desc">${p.desc}</div>
          <div class="place-meta">
            <span class="place-dist">📍 ${p.distance}</span>
            <span class="place-time">🕐 ${p.time}</span>
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
    setTimeout(showOfferModal, 500);
  },

  share() {
    haptic('light');
    const url = 'https://t.me/repka_domik_bot';
    const text = 'Уютный A-frame домик в лесу, 63 км от Москвы 🏕️';
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
      navigator.share({ title: 'A-frame домик', text, url });
    } else {
      navigator.clipboard?.writeText(`${text}\n${url}`);
    }
  },

  acceptOffer() {
    localStorage.setItem(OFFER_KEY, '1');
    hapticNotify('success');
    const card = document.querySelector('#offer-modal .offer-card');
    if (!card) return;
    card.innerHTML = `
      <span class="offer-emoji">✅</span>
      <h2 class="offer-title">Промокод готов!</h2>
      <p class="offer-subtitle">Назовите его хозяину при оформлении брони</p>
      <div class="promo-code-block">
        <span class="promo-code-text">FIRST10</span>
      </div>
      <button class="btn-offer" data-action="copyPromo">Скопировать промокод</button>
      <button class="offer-skip" data-action="closeOffer">Закрыть</button>`;
  },

  copyPromo() {
    navigator.clipboard?.writeText('FIRST10').then(() => {
      hapticNotify('success');
      const btn = document.querySelector('#offer-modal .btn-offer');
      if (btn) {
        btn.textContent = 'Скопировано ✓';
        setTimeout(() => closeOfferModal(), 1400);
      }
    }).catch(() => closeOfferModal());
  },

  closeOffer() {
    closeOfferModal();
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

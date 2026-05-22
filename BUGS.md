# BUGS.md — Журнал ошибок

Проект: TMA «A-frame домик» · Стек: vanilla JS + Telegram Web App SDK  
Файлы: `tg-app/js/app.js`, `tg-app/js/data.js`, `tg-app/css/styles.css`

---

## КРИТИЧЕСКИЕ

### BUG-001 · Расстояние от Москвы — несовпадение
**Симптом:** На экране «Домик» (`screens.home`) badge показывает «82 км», а в `data.js` и `CLAUDE.md` — «63 км».  
**Файл:** `tg-app/js/app.js:404`  
**Исправление:** Заменить текст в badge:
```js
// было:
<div class="hero-badge">Дмитровский район · 82 км от Москвы</div>
// стало:
<div class="hero-badge">Дмитровский район · 63 км от Москвы</div>
```
**Статус:** Открыт

---

### BUG-002 · Минимум ночей (2) не проверяется при бронировании
**Симптом:** Пользователь может выбрать 1 ночь и отправить заявку, хотя `APP_DATA.house.minNights = 2`.  
**Файл:** `tg-app/js/app.js` — `calcBooking()` и `setupScreenButtons('booking')`  
**Исправление:** В `setupScreenButtons` и `refreshBookingPrice` добавить проверку:
```js
const price = calcBooking();
const nights = price?.nights ?? 0;
const ok = !!(state.booking.checkIn && state.booking.checkOut
              && nights >= APP_DATA.house.minNights);
const txt = !state.booking.checkIn ? 'Выберите даты'
          : nights < APP_DATA.house.minNights ? `Минимум ${APP_DATA.house.minNights} ночи`
          : `Отправить заявку · ${fmtPrice(price.total)}`;
setMainButton(txt, submitBooking, ok);
```
**Статус:** Открыт

---

## СРЕДНИЕ

### BUG-003 · `refreshSaunaSlots()` выбирает карточки по индексу (хрупко)
**Симптом:** Если порядок `.section-card` на экране бани изменится (например, добавить блок), функция обновит не ту карточку.  
**Файл:** `tg-app/js/app.js:1051–1057`  
**Исправление:** Добавить `id="slots-section"` в HTML экрана бани и искать по нему, а не по индексу:
```js
// в screens.sauna: <div class="section-card" id="slots-section">
// в refreshSaunaSlots():
const section = document.getElementById('slots-section');
if (!section) return;
const existing = section.querySelector('.slot-grid, .no-date-hint');
if (existing) existing.outerHTML = renderSlotGrid(state.sauna.date);
const title = section.querySelector('.section-title');
if (title) title.textContent = `Доступные слоты${...}`;
```
**Статус:** Открыт

---

### BUG-004 · `MainButton._appCb` — нестандартное свойство
**Симптом:** `setMainButton` сохраняет коллбэк в `mb._appCb`, что не является частью Telegram SDK. При обновлении SDK может сломаться снятие обработчика (`mb.offClick`).  
**Файл:** `tg-app/js/app.js:57–66`  
**Исправление:** Хранить коллбэк в замыкании модуля:
```js
let _mainBtnCb = null;
function setMainButton(text, cb, active = true) {
  if (!tg) return;
  const mb = tg.MainButton;
  mb.setText(text);
  if (_mainBtnCb) mb.offClick(_mainBtnCb);
  _mainBtnCb = cb;
  mb.onClick(cb);
  active ? mb.enable() : mb.disable();
  mb.show();
}
```
**Статус:** Открыт

---

### BUG-005 · `closeOfferModal` — `transitionend` может не сработать
**Симптом:** Если браузер не воспроизводит CSS-переход (например, режим `prefers-reduced-motion` или старый WebView), `transitionend` не срабатывает и модалка остаётся в DOM.  
**Файл:** `tg-app/js/app.js:1123–1129`  
**Исправление:** Добавить fallback через `setTimeout`:
```js
function closeOfferModal() {
  localStorage.setItem(OFFER_KEY, '1');
  const modal = document.getElementById('offer-modal');
  if (!modal) return;
  modal.classList.remove('visible');
  const cleanup = () => modal.remove();
  modal.addEventListener('transitionend', cleanup, { once: true });
  setTimeout(cleanup, 500); // fallback если transitionend не сработал
}
```
**Статус:** Открыт

---

## МАЛЫЕ / КОСМЕТИКА

### BUG-006 · Счётчик гостей — неверный selector при rebind
**Симптом:** `actions.changeGuests` ищет `.counter-value` через `document.querySelector` — найдёт первый на странице. Если на экране несколько счётчиков (сейчас только один, но при добавлении сломается).  
**Файл:** `tg-app/js/app.js:1205–1207`  
**Потенциальное исправление:** Использовать ближайший родитель по `target` или задать уникальный `id`.  
**Статус:** Наблюдение (не критично пока один счётчик)

---

### BUG-007 · `avail-chip` на главной — хардкод дат
**Симптом:** «Свободно: 26–28 июня (выходные)» захардкожено в `screens.home`. Не обновляется при изменении `unavailableDates` в `data.js`.  
**Файл:** `tg-app/js/app.js:411`  
**Исправление:** Вычислять ближайший свободный уикенд динамически, или убрать chip если нет времени.  
**Статус:** Открыт (низкий приоритет)

---

## КОНФИГ / ПЕРЕД ЗАПУСКОМ

| # | Что | Файл | Значение сейчас |
|---|-----|------|-----------------|
| C-1 | Telegram username хозяина | `data.js:204` | `aframe_dom` — placeholder |
| C-2 | Телефон хозяина | `data.js:205` | `+79261234567` — placeholder |
| C-3 | URL шаринга (бот) | `app.js:1351` | `repka_domik_bot` — placeholder |
| C-4 | Координаты карты | `app.js:736` | `37.5128,56.3542` — уточнить у Сергея |
| C-5 | Wi-Fi пароль | `data.js`, `app.js:1317` | `nature2024` — уточнить у Сергея |
| C-6 | Webhook для реальных броней | `app.js:957–976` | только `navigate('success')`, не шлёт данные |
| C-7 | Реальные фото (галерея) | `data.js:56–61` | CSS-градиенты-заглушки |

---

## КАК ДОБАВИТЬ НОВЫЙ БАГ

```
### BUG-NNN · Заголовок
**Симптом:** Что происходит с точки зрения пользователя.
**Файл:** путь/к/файлу.js:строка
**Исправление:** Конкретный diff или псевдокод.
**Статус:** Открыт | Исправлен в коммите XXXXX | Не воспроизводится
```

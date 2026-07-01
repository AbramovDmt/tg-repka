# CLAUDE.md — Telegram Mini App «A-frame домик»

## Структура файлов

```
tg-app/
├── index.html          — Точка входа. HTML-оболочка, подключает SDK и скрипты.
├── css/
│   └── styles.css      — Все стили. CSS-переменные для тем, компоненты, экраны.
├── js/
│   ├── data.js         — ВЕСЬ контент приложения. Цены, тексты, слоты, места.
│   └── app.js          — Вся логика: роутер, экраны, обработчики, Telegram SDK.
└── CLAUDE.md           — Этот файл.
```

---

## Навигация между экранами

Приложение — SPA (одностраничное). Навигацией управляет объект `router` в `app.js`.

```
Главная (home)
├── Домик (house)
│   └── → Бронирование (booking) → Успех (success)
├── Бронирование (booking)    → Успех (success)
├── Баня (sauna)              → Успех (success)
├── Велосипеды (bikes)        → Успех (success)
├── Что рядом (nearby)
├── Инструкции (instructions)
└── Связь с хозяином (contact)
```

**Как добавить экран:**
1. Добавить функцию `screens.myScreen = () => \`...\`` в `app.js`
2. Добавить кнопку с `data-action="navigate" data-screen="myScreen"` в нужном экране
3. Вызвать `setupScreenButtons('myScreen', params)` в функции `setupScreenButtons`

---

## Где менять данные (js/data.js)

### Цены
```javascript
APP_DATA.house.priceWeekday = 8000       // будни пн–чт, вс (₽/ночь)
APP_DATA.house.priceWeekend = 10000      // выходные пт–сб (₽/ночь)
APP_DATA.house.cleaning = 1500           // уборка
APP_DATA.sauna.pricePerHour = 1500       // баня ₽/час (мин. 3 часа)
APP_DATA.sauna.pricePerDay = 8000        // баня ₽/сутки 1-я ночь (посуточная)
APP_DATA.sauna.pricePerDayExtra = 4000   // баня ₽/сутки 2-я и последующие ночи
APP_DATA.sauna.broomPrice = 500          // веник (если нет своего)
APP_DATA.bikes.priceDay = 1500           // велосипеды ₽/день за велосипед
APP_DATA.sup.priceDay = 800              // SUP-борд ₽/день за штуку
```

### Занятые даты (для календаря)
```javascript
APP_DATA.unavailableDates = [
  '2026-06-01', '2026-06-02',   // формат: YYYY-MM-DD
  // добавляйте сюда занятые даты
]
```

### Занятые слоты бани
```javascript
APP_DATA.sauna.bookedSlots = {
  '2026-05-21': ['14:00', '18:00'],  // дата: массив занятых слотов
}
```

### Контакты хозяина
```javascript
APP_DATA.contact.telegram = 'aframe_dom'    // ← замените на реальный username
APP_DATA.contact.phone = '+79261234567'     // ← замените на реальный номер
```

### Координаты для карты (экран "Что рядом")
В `app.js` в экране `nearby` найдите:
```
data-url="https://yandex.ru/maps/?pt=37.42054,56.48085&z=14"
```
Замените координаты на реальные (lon, lat — именно в таком порядке для Яндекса).

---

## Как добавить реальные фото

### Главный hero (фон домика)
В `css/styles.css` найдите `.hero-image` и добавьте:
```css
.hero-image {
  background-image: url('https://ваш-cdn.com/hero.jpg');
}
```

### Галерея домика
В `js/data.js` в `APP_DATA.house.gallery` замените `gradient` на `image`:
```javascript
{ label: 'Фасад домика', image: 'https://ваш-cdn.com/facade.jpg' }
```
Затем в `app.js` в функции `screens.house` измените рендер галереи:
```javascript
const gallery = data.gallery.map((item, i) => `
  <div class="gallery-item" style="background-image: url('${item.image}'); background-size: cover;">
    <div class="gallery-label">${item.label}</div>
  </div>
`).join('');
```

**Важно:** Не загружайте фото через Telegram Bot API — они сжимаются. Используйте внешний CDN (Cloudinary, ImageKit, S3).

---

## Telegram-специфика

### Где настраивается MainButton
Функция `setupScreenButtons(screenId)` в `app.js` — управляет текстом и коллбэком MainButton для каждого экрана.

### Где настраивается BackButton
В `router._render()` — показывается автоматически, если в стеке > 1 экран.

### Уведомления гостям
В текущей версии уведомления **симулируются** (Success screen). Для реальных уведомлений:
1. Создайте Telegram-бота через @BotFather
2. Добавьте `bot_token` в бэкенд
3. В `submitBooking()` / `submitSauna()` / `submitBikes()` — делайте POST на ваш API
4. API шлёт сообщение гостю через `sendMessage` с `chat_id` из `tg.initDataUnsafe.user.id`

### Как запустить в Telegram
1. Создайте бота через @BotFather
2. Команда `/newapp` → создайте Mini App
3. Укажите URL, где развёрнут `tg-app/` (нужен HTTPS)
4. Для разработки: используйте ngrok или Vercel Preview

---

## Локальный запуск (без Telegram)

Откройте `index.html` напрямую в браузере — приложение работает без Telegram SDK.
Тема определяется по системным настройкам (prefers-color-scheme).

Для хостинга: папка `tg-app/` задеплоена на Vercel (проект `tg-app`, авто-деплой с ветки `main`).

---

## Что нужно настроить перед запуском

- [ ] `APP_DATA.contact.telegram` — реальный username хозяина
- [ ] `APP_DATA.contact.phone` — реальный телефон
- [ ] `APP_DATA.unavailableDates` — актуальные занятые даты
- [ ] Координаты домика в экране `nearby`
- [ ] Реальные фото (заменить CSS-градиенты в галерее)
- [ ] Telegram Bot Token + webhook для реальных броней

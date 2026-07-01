# BACKEND-PLAN.md — A-frame домик: бэкенд-архитектура

> Минимальный бэкенд под конкретные задачи: бронирования, Avito-синхронизация, предоплата, уведомления, база гостей.

---

## Стек

```
Runtime:    Node.js + Fastify
БД:         PostgreSQL (Supabase — даёт БД + авторизацию + управление через UI)
Bot:        telegraf.js
Payments:   ЮКасса (YooKassa)
Cron:       Supabase Edge Functions (pg_cron) или Railway Cron Job
Хостинг:    Railway (backend) + Supabase (PostgreSQL)
```

---

## База данных

### `guests` — база клиентов

```sql
id              UUID PRIMARY KEY
telegram_id     BIGINT UNIQUE NOT NULL   -- из tg.initDataUnsafe.user.id
telegram_username TEXT                   -- @username если есть
first_name      TEXT NOT NULL
phone           TEXT                     -- если гость дал телефон
source          TEXT                     -- 'direct' | 'avito' | 'sutochno'
created_at      TIMESTAMPTZ DEFAULT now()
notes           TEXT                     -- заметки хозяина о госте
```

### `bookings` — бронирования домика

```sql
id              UUID PRIMARY KEY
guest_id        UUID REFERENCES guests(id)
check_in        DATE NOT NULL
check_out       DATE NOT NULL
guests_count    INT NOT NULL DEFAULT 1
comment         TEXT
total_price     INT NOT NULL             -- ₽, итого
status          TEXT NOT NULL DEFAULT 'pending'
                -- pending | confirmed | cancelled | completed
payment_status  TEXT DEFAULT 'unpaid'   -- unpaid | prepaid | paid
created_at      TIMESTAMPTZ DEFAULT now()
```

Возможные статусы:
- `pending` — заявка отправлена, ждёт подтверждения хозяина
- `confirmed` — хозяин подтвердил
- `cancelled` — отменено
- `completed` — гость выехал

### `sauna_bookings` — бронирования бани

```sql
id              UUID PRIMARY KEY
guest_id        UUID REFERENCES guests(id)
booking_id      UUID REFERENCES bookings(id) -- NULL если только баня
date            DATE NOT NULL
start_time      TIME NOT NULL               -- '16:00'
duration_hours  INT NOT NULL                -- 2 | 3 | 4
total_price     INT NOT NULL
status          TEXT DEFAULT 'confirmed'    -- сразу подтверждается
created_at      TIMESTAMPTZ DEFAULT now()
```

### `bike_rentals` — аренда велосипедов

```sql
id              UUID PRIMARY KEY
guest_id        UUID REFERENCES guests(id)
booking_id      UUID REFERENCES bookings(id) -- NULL если без брони домика
rental_date     DATE NOT NULL
bikes_count     INT NOT NULL                -- 1 | 2
duration        TEXT NOT NULL              -- '2h' | '4h' | 'day'
total_price     INT NOT NULL
status          TEXT DEFAULT 'confirmed'
created_at      TIMESTAMPTZ DEFAULT now()
```

### `avito_calendar` — кэш занятых дат из Avito

```sql
id              UUID PRIMARY KEY
date            DATE NOT NULL UNIQUE
source          TEXT DEFAULT 'avito'       -- 'avito' | 'sutochno'
synced_at       TIMESTAMPTZ DEFAULT now()
```

### `payments` — предоплаты

```sql
id              UUID PRIMARY KEY
booking_id      UUID REFERENCES bookings(id)
yookassa_id     TEXT UNIQUE               -- ID платежа в ЮКасса
amount          INT NOT NULL              -- 5000
status          TEXT DEFAULT 'pending'    -- pending | succeeded | cancelled
created_at      TIMESTAMPTZ DEFAULT now()
confirmed_at    TIMESTAMPTZ
```

---

## API эндпоинты

### Публичные (вызываются из TMA)

| Метод | URL | Что делает |
|---|---|---|
| GET | `/api/availability` | Занятые даты (объединение avito_calendar + confirmed bookings) |
| GET | `/api/sauna/slots?date=YYYY-MM-DD` | Доступные слоты бани на дату |
| POST | `/api/bookings` | Создать заявку на домик |
| POST | `/api/sauna/book` | Забронировать баню |
| POST | `/api/bikes/rent` | Арендовать велосипеды |
| POST | `/api/payments/create` | Создать платёж ЮКасса (предоплата 5000 ₽) |
| POST | `/api/payments/webhook` | Webhook ЮКасса — обновить статус брони |

**Аутентификация из TMA:** `initData` из `Telegram.WebApp.initData` — передаётся в заголовке, бэкенд верифицирует подпись через Bot Token. Это стандарт Telegram Mini Apps, не требует регистрации/логина.

### Админские (только для хозяина)

Хозяин авторизуется через Telegram — при первом входе в admin-бот отправляет `/start`, бэкенд проверяет `telegram_id` по `ADMIN_TELEGRAM_ID` из env.

| Метод | URL | Что делает |
|---|---|---|
| GET | `/admin/bookings` | Все заявки с фильтрами (статус, дата) |
| PATCH | `/admin/bookings/:id` | Подтвердить / отменить бронь |
| GET | `/admin/guests` | База гостей |
| POST | `/admin/guests/:id/notify` | Отправить сообщение гостю через бота |
| POST | `/admin/broadcast` | Рассылка по базе клиентов |
| GET | `/admin/calendar` | Все занятые даты (собственные + Avito) |
| POST | `/admin/calendar/block` | Вручную заблокировать даты |
| DELETE | `/admin/calendar/block/:date` | Разблокировать дату |

---

## Кто что видит и редактирует

### Гость (Telegram-пользователь)

**Видит:**
- Свободные даты домика
- Доступные слоты бани
- Итог своей брони после отправки (через Telegram-уведомление от бота)

**Может:**
- Создать заявку на домик
- Забронировать баню / велосипеды
- Оплатить предоплату

**Не видит:**
- Чужие брони
- База других гостей
- Ничего в БД напрямую

### Хозяин (Admin)

**Видит:**
- Все заявки со статусами
- Базу гостей с историей
- Сводку за период

**Может:**
- Подтвердить / отклонить заявку
- Заблокировать даты вручную
- Отправить сообщение конкретному гостю
- Сделать рассылку по всей базе
- Видеть статус Avito-синхронизации

---

## Avito-синхронизация

Avito предоставляет iCal-ссылку для объявления об аренде (в настройках календаря).

**Механика:**
1. Cron-задача каждые 30 минут делает GET запрос на iCal URL Avito
2. Парсит `VEVENT` записи — извлекает занятые даты
3. Сравнивает с тем, что уже есть в `avito_calendar`
4. Обновляет таблицу (upsert)

```
AVITO_ICAL_URL=https://www.avito.ru/calendar/...   ← хранится в env
```

При запросе `/api/availability` бэкенд делает:
```sql
SELECT date FROM avito_calendar
UNION
SELECT generate_series(check_in, check_out - 1, '1 day')::date
FROM bookings WHERE status IN ('pending', 'confirmed')
```

**Обратная сторона** (Avito ← наши брони): хозяин вручную отмечает даты занятыми в Avito. Автоматической записи нет — Avito не предоставляет API для этого.

---

## Предоплата

**Сумма:** 5 000 ₽ — фиксированная, независимо от стоимости брони.

**Флоу:**
1. Гость отправляет заявку → создаётся `booking` со статусом `pending`
2. Хозяин подтверждает бронь через админку → статус `confirmed`
3. Бот отправляет гостю ссылку на оплату (inline кнопка)
4. Гость платит через ЮКасса
5. ЮКасса шлёт webhook → `payment.status = succeeded`, `booking.payment_status = prepaid`
6. Бот подтверждает гостю факт оплаты

**Альтернатива без хозяина в цепочке:** предоплата сразу при бронировании (autoconfirm), хозяин только видит уведомление. Решить на этапе реализации.

---

## Telegram-уведомления

Все уведомления отправляются через бота. `chat_id` = `telegram_id` гостя, сохранённый при первой заявке.

| Событие | Кому | Текст |
|---|---|---|
| Новая заявка | Хозяину | "📬 Новая заявка на [даты] от [имя]. Гостей: N. Комментарий: ..." |
| Хозяин подтвердил | Гостю | "✅ Бронирование подтверждено! Ждём вас [дата]. Заезд с 15:00" |
| Хозяин отклонил | Гостю | "К сожалению, эти даты уже заняты. Напишите хозяину — выберем другие" |
| Ссылка на оплату | Гостю | "Для завершения брони внесите предоплату 5 000 ₽ [кнопка Оплатить]" |
| Оплата прошла | Хозяину + гостю | Хозяину: "💰 Предоплата получена от [имя]". Гостю: "Оплата получена! Бронь зафиксирована." |
| Напоминание за 1 день | Гостю | "Напоминаем: завтра ваш заезд. Заезд с 15:00. Адрес: [ссылка]" |
| После выезда | Гостю | "Спасибо за визит! Будем рады снова видеть вас. Оставьте отзыв на Авито: [ссылка]" |

Напоминание и после-выезд — cron-задача, запускается ежедневно в 10:00, проверяет завтрашние заезды и вчерашние выезды.

---

## Рассылки (admin)

Хозяин из admin-панели:
1. Выбирает сегмент: все / гости за последние N месяцев / гости без повторных броней
2. Пишет текст
3. Нажимает "Отправить"

Бэкенд итерирует по `guests`, у которых `telegram_id != NULL`, шлёт через `bot.telegram.sendMessage()`.

Лимит: Telegram разрешает ~30 сообщений/сек — добавить задержку `setInterval` между отправками.

---

## Переменные окружения

```env
DATABASE_URL=postgresql://...           # Supabase connection string
BOT_TOKEN=...                           # Telegram Bot Token (@BotFather)
ADMIN_TELEGRAM_ID=...                   # telegram_id хозяина
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
AVITO_ICAL_URL=...                      # iCal URL из настроек Avito
APP_URL=https://...                     # URL фронтенда (для кнопок в боте)
```

---

## Порядок реализации

```
1. БД + Supabase проект → таблицы из этого плана
2. Fastify-приложение: /api/availability + /api/sauna/slots
3. Подключение TMA к реальному API (заменить статичный data.js)
4. POST /api/bookings + уведомление хозяину
5. Telegram-бот: подтверждение/отклонение через кнопки в сообщении
6. Upsert гостя при каждой заявке → база клиентов растёт автоматически
7. Статус заявки в TMA (см. ниже)
8. Avito iCal-синхронизация (cron)
9. ЮКасса: создание платежа + webhook
10. Admin-панель (веб, доступ по telegram_id)
11. Рассылки
```

---

## UX: статус заявки в приложении

После отправки заявки пользователь должен видеть её статус — пока хозяин не подтвердил.

### Что показывать

**На главном экране** — карточка-статус между hero и навигационной сеткой:

```
┌─────────────────────────────────┐
│ 🟡 Ваша заявка · 14–16 июня     │
│    Ожидает подтверждения хозяина │
└─────────────────────────────────┘
```

Цвет чипа меняется по статусу:
- `pending` → янтарный (amber `#C8742A`)
- `confirmed` → зелёный
- `cancelled` → серый + текст "Отменено"

**В календаре** — даты pending-заявки подсвечиваются янтарным (не серым, как чужие занятые даты), с tooltip "ваша заявка".

### Механика

1. После `POST /api/bookings` → ответ содержит `{ id, status: 'pending', checkIn, checkOut }`
2. TMA сохраняет в `localStorage` (`repka_booking: { id, status, checkIn, checkOut, submittedAt }`)
3. При каждом открытии приложения — `GET /api/bookings/:id` → обновляет localStorage если статус изменился
4. Хозяин нажал "Подтвердить" в боте → статус в БД меняется на `confirmed` → при следующем открытии TMA покажет зелёный статус

### Когда убирать карточку

- Автоматически через 24 часа после даты выезда (`checkOut`)
- Или когда статус `cancelled` и пользователь закрыл карточку вручную

---

*BACKEND-PLAN.md — живой документ. Обновляется по мере принятия архитектурных решений.*

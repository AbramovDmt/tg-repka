/* Telegram bot webhook — Netlify Function
   Responds to messages with a reply keyboard containing WebApp buttons.
   Env var required: TELEGRAM_BOT_TOKEN */

const APP_URL = 'https://repka-domik.netlify.app';

const KEYBOARD = {
  keyboard: [
    [
      { text: '🏠 Заказать домик',      web_app: { url: `${APP_URL}?startapp=booking` } },
      { text: '🔥 Забронировать баню',  web_app: { url: `${APP_URL}?startapp=sauna`   } },
    ],
    [
      { text: '✉️ Связаться с хозяином', web_app: { url: `${APP_URL}?startapp=contact` } },
    ],
  ],
  resize_keyboard: true,
  persistent: true,
};

async function sendMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: KEYBOARD }),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { statusCode: 500, body: 'No token' };

  let update;
  try { update = JSON.parse(event.body); }
  catch { return { statusCode: 200, body: 'OK' }; }

  const msg = update.message;
  if (!msg) return { statusCode: 200, body: 'OK' };

  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();

  let reply;
  if (text === '/start') {
    const name = msg.from?.first_name || '';
    reply = name
      ? `Привет, ${name}! 👋\nВыберите действие или откройте приложение:`
      : 'Привет! 👋\nВыберите действие или откройте приложение:';
  } else {
    reply = 'Воспользуйтесь кнопками ниже или откройте приложение 👇';
  }

  await sendMessage(token, chatId, reply);
  return { statusCode: 200, body: 'OK' };
};

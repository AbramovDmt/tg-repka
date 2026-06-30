/* Vercel serverless: notify owner via Telegram Bot API
   Env vars required: TELEGRAM_BOT_TOKEN, OWNER_CHAT_ID */

function fmt(n) {
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}

function buildText({ order, comment, user }) {
  const lines = ['📋 <b>Новая заявка</b>'];

  if (order.house) {
    const h = order.house;
    lines.push('');
    lines.push('🏠 <b>Домик</b>');
    lines.push(`${h.checkIn} → ${h.checkOut} · ${h.nights} ноч.`);
    lines.push(`Гостей: ${h.guests} чел.`);
    lines.push(`Сумма: ${fmt(h.price)}`);
    if (h.saunaIncluded) lines.push('✓ Баня включена');
  }

  if (order.sauna && !order.house?.saunaIncluded) {
    const s = order.sauna;
    lines.push('');
    lines.push('🔥 <b>Баня</b>');
    if (s.perDay) {
      lines.push(`Посуточно · ${s.nights} ноч.`);
    } else {
      lines.push(`${s.date} · ${s.slot} · ${s.duration} ч.`);
    }
    lines.push(`Сумма: ${fmt(s.price)}`);
  }

  if (order.bikes) {
    const b = order.bikes;
    lines.push('');
    lines.push('🚲 <b>Велосипеды/SUP</b>');
    if (b.count) lines.push(`Велосипеды: ${b.count} шт.`);
    if (b.sup) lines.push(`SUP: ${b.sup} шт.`);
    lines.push(`Сумма: ${fmt(b.price)}`);
  }

  if (comment) {
    lines.push('');
    lines.push(`💬 <i>${comment}</i>`);
  }

  const total = (order.house?.price || 0) +
    (!order.house?.saunaIncluded && order.sauna ? order.sauna.price : 0) +
    (order.bikes?.price || 0);
  if (total > 0) {
    lines.push('');
    lines.push(`💰 <b>Итого: ${fmt(total)}</b>`);
  }

  if (user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const contact = user.username
      ? `@${user.username}`
      : `<a href="tg://user?id=${user.id}">${name || 'без имени'}</a>`;
    lines.push('');
    lines.push(`👤 ${name || '—'} · ${contact}`);
  }

  return lines.join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.OWNER_CHAT_ID;
  if (!token || !ownerId) return res.status(200).end('Not configured');

  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).end('Bad JSON');

  const text = buildText(data);

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ownerId, text, parse_mode: 'HTML' }),
  });

  res.status(200).end('OK');
};

const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

const usuarios = {};
const apuestas = {};
const bonusUsado = {};

function getUsuario(id, nombre) {
  if (!usuarios[id]) {
    usuarios[id] = { nombre, saldo: 1000, apuestas: 0, ganadas: 0 };
  }
  return usuarios[id];
}

bot.onText(/\/start/, (msg) => {
  const u = getUsuario(msg.from.id, msg.from.first_name);
  bot.sendMessage(msg.chat.id,
    '⚽ *Bienvenido al Bot de Apuestas* 🎰\n\nHola *' + u.nombre + '*! Tienes *' + u.saldo + ' créditos*.\n\nUsa /help para ver comandos.',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '🎰 *Comandos:*\n\n⚽ /partidos\n💰 /apostar\n📊 /misapuestas\n👤 /perfil\n🏆 /ranking\n🎁 /bonus\n❓ /ayuda',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/partidos/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '⚽ *Partidos disponibles:*\n\n' +
    '1️⃣ Real Madrid vs Barcelona\n   madrid: x1.85 | empate: x3.20 | barcelona: x2.10\n\n' +
    '2️⃣ Man City vs Arsenal\n   city: x1.60 | empate: x3.50 | arsenal: x2.80\n\n' +
    '3️⃣ PSG vs Bayern\n   psg: x2.20 | empate: x3.10 | bayern: x1.75\n\n' +
    '4️⃣ Liverpool vs Chelsea\n   liverpool: x1.90 | empate: x3.30 | chelsea: x2.50\n\n' +
    '💡 Usa: /apostar 1 madrid 200',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/apostar (.+)/, (msg, match) => {
  const u = getUsuario(msg.from.id, msg.from.first_name);
  const args = match[1].trim().split(' ');
  if (args.length < 3) {
    return bot.sendMessage(msg.chat.id, '❌ Uso: /apostar [partido] [equipo] [cantidad]\nEjemplo: /apostar 1 madrid 200');
  }
  const partido = parseInt(args[0]);
  const resultado = args[1].toLowerCase();
  const cantidad = parseInt(args[2]);
  const partidos = {
    1: { nombre: 'Real Madrid vs Barcelona', opciones: { madrid: 1.85, empate: 3.20, barcelona: 2.10 } },
    2: { nombre: 'Man City vs Arsenal', opciones: { city: 1.60, empate: 3.50, arsenal: 2.80 } },
    3: { nombre: 'PSG vs Bayern', opciones: { psg: 2.20, empate: 3.10, bayern: 1.75 } },
    4: { nombre: 'Liverpool vs Chelsea', opciones: { liverpool: 1.90, empate: 3.30, chelsea: 2.50 } },
  };
  if (!partidos[partido]) return bot.sendMessage(msg.chat.id, '❌ Partido no existe. Usa /partidos');
  const p = partidos[partido];
  const cuota = p.opciones[resultado];
  if (!cuota) return bot.sendMessage(msg.chat.id, '❌ Resultado inválido. Opciones: ' + Object.keys(p.opciones).join(', '));
  if (isNaN(cantidad) || cantidad <= 0) return bot.sendMessage(msg.chat.id, '❌ Cantidad inválida.');
  if (cantidad > u.saldo) return bot.sendMessage(msg.chat.id, '❌ Saldo insuficiente. Tienes ' + u.saldo + ' créditos.');
  u.saldo -= cantidad;
  u.apuestas++;
  const ganancia = Math.round(cantidad * cuota);
  bot.sendMessage(msg.chat.id,
    '✅ *Apuesta registrada!*\n\n⚽ ' + p.nombre + '\n🎯 ' + resultado + '\n💰 ' + cantidad + ' créditos\n📈 Cuota: x' + cuota + '\n🏆 Ganancia potencial: ' + ganancia + ' créditos\n\n⏳ Calculando resultado...',
    { parse_mode: 'Markdown' }
  );
  setTimeout(() => {
    const gana = Math.random() > 0.5;
    if (gana) {
      u.saldo += ganancia;
      u.ganadas++;
      bot.sendMessage(msg.chat.id, '🎉 *GANASTE!*\n\n+' + ganancia + ' créditos!\n💳 Saldo: ' + u.saldo, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, '😔 *Perdiste*\n\n-' + cantidad + ' créditos\n💳 Saldo: ' + u.saldo + '\n🎁 Usa /bonus', { parse_mode: 'Markdown' });
    }
  }, 3000);
});

bot.onText(/\/perfil/, (msg) => {
  const u = getUsuario(msg.from.id, msg.from.first_name);
  const ratio = u.apuestas > 0 ? Math.round((u.ganadas / u.apuestas) * 100) : 0;
  bot.sendMessage(msg.chat.id,
    '👤 *Perfil de ' + u.nombre + '*\n\n💳 Saldo: ' + u.saldo + ' créditos\n🎰 Apuestas: ' + u.apuestas + '\n✅ Ganadas: ' + u.ganadas + '\n📊 Ratio: ' + ratio + '%',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/bonus/, (msg) => {
  const hoy = new Date().toDateString();
  const key = msg.from.id + '_' + hoy;
  if (bonusUsado[key]) return bot.sendMessage(msg.chat.id, '⏰ Ya reclamaste tu bonus hoy. Vuelve mañana!');
  const bonus = Math.floor(Math.random() * 200) + 100;
  const u = getUsuario(msg.from.id, msg.from.first_name);
  u.saldo += bonus;
  bonusUsado[key] = true;
  bot.sendMessage(msg.chat.id, '🎁 *Bonus reclamado!*\n\n+' + bonus + ' créditos!\n💳 Saldo: ' + u.saldo, { parse_mode: 'Markdown' });
});

bot.onText(/\/ranking/, (msg) => {
  const lista = Object.values(usuarios).sort((a, b) => b.saldo - a.saldo).slice(0, 5);
  if (lista.length === 0) return bot.sendMessage(msg.chat.id, '🏆 Aún no hay apostadores.');
  const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  let texto = '🏆 *Ranking:*\n\n';
  lista.forEach((u, i) => { texto += medallas[i] + ' ' + u.nombre + ' — ' + u.saldo + ' créditos\n'; });
  bot.sendMessage(msg.chat.id, texto, { parse_mode: 'Markdown' });
});

bot.onText(/\/ayuda/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '❓ *Cómo funciona:*\n\n1️⃣ /start — 1000 créditos gratis\n2️⃣ /partidos — ver partidos\n3️⃣ /apostar 1 madrid 200\n4️⃣ Si aciertas ganas según la cuota\n5️⃣ /bonus — créditos gratis cada día',
    { parse_mode: 'Markdown' }
  );
});

bot.on('new_chat_members', (msg) => {
  msg.new_chat_members.forEach((member) => {
    getUsuario(member.id, member.first_name);
    bot.sendMessage(msg.chat.id, '⚽ Bienvenido/a *' + member.first_name + '*! Tienes 1000 créditos para apostar. Usa /ayuda', { parse_mode: 'Markdown' });
  });
});

console.log('✅ Bot de Apuestas Deportivas arrancado!');

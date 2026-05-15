const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '8847530149:AAGfpUJFNU71_VoldaODK5-1z45x4_f3-gY';
const bot = new TelegramBot(TOKEN, { polling: true });

const usuarios = {};
const bonusUsado = {};

function getUsuario(id, nombre) {
  if (!usuarios[id]) {
    usuarios[id] = { nombre: nombre, saldo: 1000, apuestas: 0, ganadas: 0 };
  }
  return usuarios[id];
}

bot.onText(/\/start/, function(msg) {
  var u = getUsuario(msg.from.id, msg.from.first_name);
  bot.sendMessage(msg.chat.id, 'Bienvenido ' + u.nombre + '! Tienes ' + u.saldo + ' creditos. Usa /help para ver comandos.');
});

bot.onText(/\/help/, function(msg) {
  bot.sendMessage(msg.chat.id, 'Comandos:\n/partidos - Ver partidos\n/apostar - Apostar\n/perfil - Tu perfil\n/bonus - Creditos gratis\n/ranking - Top apostadores\n/ayuda - Como funciona');
});

bot.onText(/\/partidos/, function(msg) {
  bot.sendMessage(msg.chat.id, 'Partidos disponibles:\n\n1 - Real Madrid vs Barcelona\n   madrid: x1.85 | empate: x3.20 | barcelona: x2.10\n\n2 - Man City vs Arsenal\n   city: x1.60 | empate: x3.50 | arsenal: x2.80\n\n3 - PSG vs Bayern\n   psg: x2.20 | empate: x3.10 | bayern: x1.75\n\n4 - Liverpool vs Chelsea\n   liverpool: x1.90 | empate: x3.30 | chelsea: x2.50\n\nUsa: /apostar 1 madrid 200');
});

bot.onText(/\/apostar (.+)/, function(msg, match) {
  var u = getUsuario(msg.from.id, msg.from.first_name);
  var args = match[1].trim().split(' ');
  if (args.length < 3) {
    bot.sendMessage(msg.chat.id, 'Uso correcto: /apostar 1 madrid 200');
    return;
  }
  var partido = parseInt(args[0]);
  var resultado = args[1].toLowerCase();
  var cantidad = parseInt(args[2]);
  var partidos = {
    1: { nombre: 'Real Madrid vs Barcelona', opciones: { madrid: 1.85, empate: 3.20, barcelona: 2.10 } },
    2: { nombre: 'Man City vs Arsenal', opciones: { city: 1.60, empate: 3.50, arsenal: 2.80 } },
    3: { nombre: 'PSG vs Bayern', opciones: { psg: 2.20, empate: 3.10, bayern: 1.75 } },
    4: { nombre: 'Liverpool vs Chelsea', opciones: { liverpool: 1.90, empate: 3.30, chelsea: 2.50 } }
  };
  if (!partidos[partido]) {
    bot.sendMessage(msg.chat.id, 'Partido no existe. Usa /partidos');
    return;
  }
  var p = partidos[partido];
  var cuota = p.opciones[resultado];
  if (!cuota) {
    bot.sendMessage(msg.chat.id, 'Resultado invalido. Opciones: ' + Object.keys(p.opciones).join(', '));
    return;
  }
  if (isNaN(cantidad) || cantidad <= 0) {
    bot.sendMessage(msg.chat.id, 'Cantidad invalida.');
    return;
  }
  if (cantidad > u.saldo) {
    bot.sendMessage(msg.chat.id, 'Saldo insuficiente. Tienes ' + u.saldo + ' creditos.');
    return;
  }
  u.saldo -= cantidad;
  u.apuestas++;
  var ganancia = Math.round(cantidad * cuota);
  bot.sendMessage(msg.chat.id, 'Apuesta registrada!\n' + p.nombre + '\nApuesta: ' + resultado + '\nCantidad: ' + cantidad + ' creditos\nCuota: x' + cuota + '\nGanancia potencial: ' + ganancia + ' creditos\nCalculando resultado...');
  setTimeout(function() {
    var gana = Math.random() > 0.5;
    if (gana) {
      u.saldo += ganancia;
      u.ganadas++;
      bot.sendMessage(msg.chat.id, 'GANASTE! +' + ganancia + ' creditos!\nSaldo actual: ' + u.saldo + ' creditos');
    } else {
      bot.sendMessage(msg.chat.id, 'Perdiste. -' + cantidad + ' creditos\nSaldo actual: ' + u.saldo + ' creditos\nUsa /bonus para conseguir mas creditos');
    }
  }, 3000);
});

bot.onText(/\/perfil/, function(msg) {
  var u = getUsuario(msg.from.id, msg.from.first_name);
  var ratio = u.apuestas > 0 ? Math.round((u.ganadas / u.apuestas) * 100) : 0;
  bot.sendMessage(msg.chat.id, 'Perfil de ' + u.nombre + '\nSaldo: ' + u.saldo + ' creditos\nApuestas: ' + u.apuestas + '\nGanadas: ' + u.ganadas + '\nRatio: ' + ratio + '%');
});

bot.onText(/\/bonus/, function(msg) {
  var hoy = new Date().toDateString();
  var key = msg.from.id + '_' + hoy;
  if (bonusUsado[key]) {
    bot.sendMessage(msg.chat.id, 'Ya reclamaste tu bonus hoy. Vuelve manana!');
    return;
  }
  var bonus = Math.floor(Math.random() * 200) + 100;
  var u = getUsuario(msg.from.id, msg.from.first_name);
  u.saldo += bonus;
  bonusUsado[key] = true;
  bot.sendMessage(msg.chat.id, 'Bonus reclamado! +' + bonus + ' creditos!\nSaldo: ' + u.saldo + ' creditos');
});

bot.onText(/\/ranking/, function(msg) {
  var lista = Object.values(usuarios).sort(function(a, b) { return b.saldo - a.saldo; }).slice(0, 5);
  if (lista.length === 0) {
    bot.sendMessage(msg.chat.id, 'Aun no hay apostadores.');
    return;
  }
  var texto = 'Ranking de apostadores:\n\n';
  lista.forEach(function(u, i) {
    texto += (i + 1) + '. ' + u.nombre + ' - ' + u.saldo + ' creditos\n';
  });
  bot.sendMessage(msg.chat.id, texto);
});

bot.onText(/\/ayuda/, function(msg) {
  bot.sendMessage(msg.chat.id, 'Como funciona:\n1. /start - 1000 creditos gratis\n2. /partidos - ver partidos\n3. /apostar 1 madrid 200\n4. Si aciertas ganas segun la cuota\n5. /bonus - creditos gratis cada dia');
});

bot.on('new_chat_members', function(msg) {
  msg.new_chat_members.forEach(function(member) {
    getUsuario(member.id, member.first_name);
    bot.sendMessage(msg.chat.id, 'Bienvenido ' + member.first_name + '! Tienes 1000 creditos para apostar. Usa /ayuda');
  });
});

console.log('Bot de Apuestas Deportivas arrancado!');

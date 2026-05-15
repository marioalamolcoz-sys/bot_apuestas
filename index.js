import TelegramBot from "node-telegram-bot-api";
import { logger } from "./lib/logger";

interface Usuario {
  nombre: string;
  saldo: number;
  apuestas: number;
  ganadas: number;
}

interface Apuesta {
  id: number;
  partido: string;
  resultado: string;
  cantidad: number;
  cuota: number;
  ganancia: number;
  estado: "pendiente" | "ganada" | "perdida";
}

const apuestas: Record<number, Apuesta[]> = {};
const usuarios: Record<number, Usuario> = {};
const bonusUsado: Record<string, boolean> = {};

// ─── EDITA AQUÍ LOS PARTIDOS ───
const partidos: Record<
  number,
  { nombre: string; opciones: Record<string, number> }
> = {
  1: {
    nombre: "Real Madrid vs Barcelona",
    opciones: { madrid: 1.85, empate: 3.2, barcelona: 2.1 },
  },
  2: {
    nombre: "Manchester City vs Arsenal",
    opciones: { city: 1.6, empate: 3.5, arsenal: 2.8 },
  },
  3: {
    nombre: "PSG vs Bayern Munich",
    opciones: { psg: 2.2, empate: 3.1, bayern: 1.75 },
  },
  4: {
    nombre: "Liverpool vs Chelsea",
    opciones: { liverpool: 1.9, empate: 3.3, chelsea: 2.5 },
  },
};

function getUsuario(id: number, nombre: string): Usuario {
  if (!usuarios[id]) {
    usuarios[id] = { nombre, saldo: 1000, apuestas: 0, ganadas: 0 };
  }
  return usuarios[id]!;
}

export function startBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });

  // ─── /start ───
  bot.onText(/\/start/, (msg) => {
    const u = getUsuario(msg.from!.id, msg.from!.first_name);
    bot.sendMessage(
      msg.chat.id,
      `⚽ *Bienvenido al Bot de Apuestas Deportivas* 🎰\n\n` +
        `Hola *${u.nombre}*! Tienes *${u.saldo} créditos* para apostar.\n\n` +
        `Usa /help para ver todos los comandos.`,
      { parse_mode: "Markdown" },
    );
  });

  // ─── /help ───
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `🎰 *Comandos del Bot de Apuestas:*\n\n` +
        `⚽ /partidos — Ver partidos disponibles\n` +
        `💰 /apostar — Hacer una apuesta\n` +
        `📊 /misapuestas — Ver tus apuestas activas\n` +
        `👤 /perfil — Ver tu perfil y saldo\n` +
        `🏆 /ranking — Top apostadores\n` +
        `📈 /estadisticas — Estadísticas del grupo\n` +
        `🎁 /bonus — Reclamar bonus diario\n` +
        `❓ /ayuda — Cómo funciona`,
      { parse_mode: "Markdown" },
    );
  });

  // ─── /partidos ───
  bot.onText(/\/partidos/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `⚽ *Partidos disponibles para apostar:*\n\n` +
        `1️⃣ Real Madrid vs Barcelona\n` +
        `   🔵 Madrid gana: x1.85 | Empate: x3.20 | 🔴 Barça gana: x2.10\n\n` +
        `2️⃣ Manchester City vs Arsenal\n` +
        `   🔵 City gana: x1.60 | Empate: x3.50 | 🔴 Arsenal gana: x2.80\n\n` +
        `3️⃣ PSG vs Bayern Munich\n` +
        `   🔵 PSG gana: x2.20 | Empate: x3.10 | 🔴 Bayern gana: x1.75\n\n` +
        `4️⃣ Liverpool vs Chelsea\n` +
        `   🔵 Liverpool gana: x1.90 | Empate: x3.30 | 🔴 Chelsea gana: x2.50\n\n` +
        `💡 Usa /apostar para realizar tu apuesta`,
      { parse_mode: "Markdown" },
    );
  });

  // ─── /apostar ───
  bot.onText(/\/apostar (.+)/, (msg, match) => {
    const u = getUsuario(msg.from!.id, msg.from!.first_name);
    const args = match![1]!.trim().split(" ");

    if (args.length < 3) {
      return void bot.sendMessage(
        msg.chat.id,
        `❌ Formato incorrecto.\n\n` +
          `✅ Uso correcto:\n/apostar [partido] [resultado] [cantidad]\n\n` +
          `Ejemplo:\n/apostar 1 madrid 200\n/apostar 2 empate 150\n/apostar 3 bayern 100`,
        { parse_mode: "Markdown" },
      );
    }

    const partidoNum = parseInt(args[0]!);
    const resultado = args[1]!.toLowerCase();
    const cantidad = parseInt(args[2]!);

    const p = partidos[partidoNum];
    if (!p) {
      return void bot.sendMessage(
        msg.chat.id,
        `❌ Partido ${partidoNum} no existe. Usa /partidos para ver los disponibles.`,
      );
    }

    const cuota = p.opciones[resultado];
    if (!cuota) {
      const opciones = Object.keys(p.opciones).join(", ");
      return void bot.sendMessage(
        msg.chat.id,
        `❌ Resultado inválido. Opciones para este partido: *${opciones}*`,
        { parse_mode: "Markdown" },
      );
    }

    if (isNaN(cantidad) || cantidad <= 0) {
      return void bot.sendMessage(
        msg.chat.id,
        `❌ Cantidad inválida. Escribe un número mayor que 0.`,
      );
    }

    if (cantidad > u.saldo) {
      return void bot.sendMessage(
        msg.chat.id,
        `❌ Saldo insuficiente. Tienes *${u.saldo} créditos*.`,
        { parse_mode: "Markdown" },
      );
    }

    u.saldo -= cantidad;
    u.apuestas++;
    const ganancia = Math.round(cantidad * cuota);
    const id = Date.now();

    if (!apuestas[msg.from!.id]) apuestas[msg.from!.id] = [];
    apuestas[msg.from!.id]!.push({
      id,
      partido: p.nombre,
      resultado,
      cantidad,
      cuota,
      ganancia,
      estado: "pendiente",
    });

    bot.sendMessage(
      msg.chat.id,
      `✅ *Apuesta registrada!*\n\n` +
        `⚽ ${p.nombre}\n` +
        `🎯 Tu apuesta: ${resultado}\n` +
        `💰 Cantidad: ${cantidad} créditos\n` +
        `📈 Cuota: x${cuota}\n` +
        `🏆 Ganancia potencial: ${ganancia} créditos\n\n` +
        `⏳ Calculando resultado...`,
      { parse_mode: "Markdown" },
    );

    const gana = Math.random() > 0.5;
    setTimeout(() => {
      if (gana) {
        u.saldo += ganancia;
        u.ganadas++;
        bot.sendMessage(
          msg.chat.id,
          `🎉 *¡APUESTA GANADA!*\n\n` +
            `⚽ ${p.nombre}\n` +
            `✅ Resultado: ${resultado}\n` +
            `💰 Apostaste: ${cantidad} créditos\n` +
            `📈 Cuota: x${cuota}\n` +
            `🏆 Ganancia: *+${ganancia} créditos*\n\n` +
            `💳 Saldo actual: *${u.saldo} créditos*`,
          { parse_mode: "Markdown" },
        );
      } else {
        bot.sendMessage(
          msg.chat.id,
          `😔 *Apuesta perdida*\n\n` +
            `⚽ ${p.nombre}\n` +
            `❌ Resultado: ${resultado}\n` +
            `💸 Perdiste: ${cantidad} créditos\n\n` +
            `💳 Saldo actual: *${u.saldo} créditos*\n` +
            `🎁 Usa /bonus para conseguir más créditos`,
          { parse_mode: "Markdown" },
        );
      }
    }, 3000);
  });

  // ─── /misapuestas ───
  bot.onText(/\/misapuestas/, (msg) => {
    const lista = apuestas[msg.from!.id];
    if (!lista || lista.length === 0) {
      return void bot.sendMessage(
        msg.chat.id,
        `📊 No tienes apuestas registradas.\n\nUsa /partidos para ver los partidos disponibles.`,
      );
    }
    const ultimas = lista.slice(-5).reverse();
    let texto = `📊 *Tus últimas apuestas:*\n\n`;
    ultimas.forEach((a) => {
      const icono =
        a.estado === "ganada" ? "✅" : a.estado === "perdida" ? "❌" : "⏳";
      texto += `${icono} ${a.partido}\n🎯 ${a.resultado} | 💰 ${a.cantidad} cr | x${a.cuota}\n\n`;
    });
    bot.sendMessage(msg.chat.id, texto, { parse_mode: "Markdown" });
  });

  // ─── /perfil ───
  bot.onText(/\/perfil/, (msg) => {
    const u = getUsuario(msg.from!.id, msg.from!.first_name);
    const ratio =
      u.apuestas > 0 ? Math.round((u.ganadas / u.apuestas) * 100) : 0;
    bot.sendMessage(
      msg.chat.id,
      `👤 *Perfil de ${u.nombre}*\n\n` +
        `💳 Saldo: *${u.saldo} créditos*\n` +
        `🎰 Apuestas totales: ${u.apuestas}\n` +
        `✅ Apuestas ganadas: ${u.ganadas}\n` +
        `📊 Ratio de acierto: ${ratio}%\n\n` +
        `🎁 Usa /bonus para créditos gratis`,
      { parse_mode: "Markdown" },
    );
  });

  // ─── /bonus ───
  bot.onText(/\/bonus/, (msg) => {
    const hoy = new Date().toDateString();
    const key = `${msg.from!.id}_${hoy}`;
    if (bonusUsado[key]) {
      return void bot.sendMessage(
        msg.chat.id,
        `⏰ Ya reclamaste tu bonus hoy.\n\nVuelve mañana para más créditos gratis! 🎁`,
      );
    }
    const bonus = Math.floor(Math.random() * 200) + 100;
    const u = getUsuario(msg.from!.id, msg.from!.first_name);
    u.saldo += bonus;
    bonusUsado[key] = true;
    bot.sendMessage(
      msg.chat.id,
      `🎁 *¡Bonus diario reclamado!*\n\n` +
        `💰 +${bonus} créditos añadidos\n` +
        `💳 Saldo actual: *${u.saldo} créditos*\n\n` +
        `Vuelve mañana para más! 🎰`,
      { parse_mode: "Markdown" },
    );
  });

  // ─── /ranking ───
  bot.onText(/\/ranking/, (msg) => {
    const lista = Object.values(usuarios)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5);

    if (lista.length === 0) {
      return void bot.sendMessage(
        msg.chat.id,
        `🏆 Aún no hay apostadores. ¡Sé el primero con /apostar!`,
      );
    }

    const medallas = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    let texto = `🏆 *Ranking de apostadores:*\n\n`;
    lista.forEach((u, i) => {
      texto += `${medallas[i]} ${u.nombre} — *${u.saldo} créditos*\n`;
    });
    bot.sendMessage(msg.chat.id, texto, { parse_mode: "Markdown" });
  });

  // ─── /estadisticas ───
  bot.onText(/\/estadisticas/, (msg) => {
    const total = Object.values(usuarios).length;
    const totalApuestas = Object.values(usuarios).reduce(
      (a, u) => a + u.apuestas,
      0,
    );
    bot.sendMessage(
      msg.chat.id,
      `📈 *Estadísticas del grupo:*\n\n` +
        `👥 Apostadores registrados: ${total}\n` +
        `🎰 Apuestas realizadas: ${totalApuestas}\n` +
        `⚽ Partidos disponibles: 4\n` +
        `🎁 Bonus diario: 100-300 créditos`,
      { parse_mode: "Markdown" },
    );
  });

  // ─── /ayuda ───
  bot.onText(/\/ayuda/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `❓ *¿Cómo funciona?*\n\n` +
        `1️⃣ Empieza con /start — recibes 1000 créditos gratis\n` +
        `2️⃣ Mira los partidos con /partidos\n` +
        `3️⃣ Apuesta con /apostar [partido] [equipo] [cantidad]\n` +
        `   Ejemplo: /apostar 1 madrid 200\n` +
        `4️⃣ Si aciertas, ganas según la cuota\n` +
        `5️⃣ Reclama bonus diario con /bonus\n\n` +
        `⚠️ _Este bot es solo para entretenimiento. No usa dinero real._`,
      { parse_mode: "Markdown" },
    );
  });

  // ─── Bienvenida nuevos miembros ───
  bot.on("new_chat_members", (msg) => {
    if (!msg.new_chat_members) return;
    msg.new_chat_members.forEach((member) => {
      getUsuario(member.id, member.first_name);
      bot.sendMessage(
        msg.chat.id,
        `⚽ *¡Bienvenido/a ${member.first_name} al grupo de apuestas!* 🎰\n\n` +
          `💳 Tienes *1000 créditos* para empezar\n` +
          `Usa /partidos para ver en qué apostar\n` +
          `Usa /ayuda para aprender cómo funciona`,
        { parse_mode: "Markdown" },
      );
    });
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  logger.info("Bot de Apuestas Deportivas arrancado!");
}

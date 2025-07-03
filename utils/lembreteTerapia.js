const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { EmbedBuilder } = require("discord.js");

moment.tz.setDefault("America/Sao_Paulo");

// Configurações
const canalId = "1377761471148199946";
const hyandroId = "759635802816512041"; // SEU ID
const matheusId = "866805922835464233"; // ID do Matheus
const controlePath = path.join(__dirname, "../data/controleTerapia.json");

// Garante que o arquivo de controle existe
function inicializarArquivo() {
  if (!fs.existsSync(controlePath)) {
    fs.writeFileSync(controlePath, JSON.stringify({
      pago: false,
      confirmado: false,
      ultimoPagamento: null,
      registradoPor: null,
      semana: moment().format("YYYY-WW")
    }, null, 2));
  }
}

// Mensagens dos lembretes
const mensagens = {
  "09": `🌸 **Bom dia, Matheus!** (🐰)\n"Já pensou em pagar a terapia do Hyandro hoje?"`,
  "13": `🍱 **Hora do almoço!** (🐺)\n"Matheus... dá pra pagar a terapia?"`,
  "19": `🌙 **Boa noite!** (🦍)\n"Matheus... o Hyandro já tá virando um zumbi."`,
  "23": `🎸 **AAAAAHHHH!** (🦊🎸)\n"MATHEUSSSS! PAGA ESSA TERAPIA AGORA!"`
};

// Função principal
function iniciarLembretesTerapia(client) {
  inicializarArquivo();

  // Reset semanal
  cron.schedule("1 0 * * 1", () => {
    const novoEstado = {
      pago: false,
      confirmado: false,
      ultimoPagamento: null,
      registradoPor: "reset automático",
      semana: moment().format("YYYY-WW")
    };
    fs.writeFileSync(controlePath, JSON.stringify(novoEstado, null, 2));
    console.log("♻️ Reset semanal realizado:", novoEstado);
  }, { timezone: "America/Sao_Paulo" });

  // Lembretes diários
  cron.schedule("0 9,13,19,23 * * *", () => {
    const hora = moment().format("HH");
    enviarLembrete(client, hora);
  }, { timezone: "America/Sao_Paulo" });

  // Comandos manuais
  client.on("messageCreate", async (message) => {
    if (message.author.id !== hyandroId && message.author.id !== matheusId) return;

    if (message.content === "!pago") {
      const novoEstado = {
        pago: true,
        confirmado: message.author.id === hyandroId,
        ultimoPagamento: moment().toISOString(),
        registradoPor: `comando !pago (${message.author.username})`,
        semana: moment().format("YYYY-WW")
      };
      fs.writeFileSync(controlePath, JSON.stringify(novoEstado, null, 2));
      await message.reply(`✅ Status atualizado! ${novoEstado.confirmado ? 'CONFIRMADO' : 'Pago (aguardando confirmação)'}`);
    }

    if (message.content === "!status") {
      const estado = JSON.parse(fs.readFileSync(controlePath, 'utf8'));
      await message.reply(`📊 Status atual:\n` +
        `- Pago: ${estado.pago ? '✅' : '❌'}\n` +
        `- Confirmado: ${estado.confirmado ? '✅' : '❌'}\n` +
        `- Último pagamento: ${estado.ultimoPagamento || 'Nunca'}\n` +
        `- Semana: ${estado.semana}`);
    }
  });
}

async function enviarLembrete(client, hora) {
  let estado;
  try {
    estado = JSON.parse(fs.readFileSync(controlePath, 'utf8'));
    
    // Verifica se já está pago E confirmado NA SEMANA ATUAL
    if (estado.pago && estado.confirmado && estado.semana === moment().format("YYYY-WW")) {
      return console.log("⏭️ Pagamento já confirmado esta semana");
    }
  } catch (err) {
    console.error("⚠️ Erro ao ler arquivo:", err);
    estado = { pago: false, confirmado: false, semana: moment().format("YYYY-WW") };
  }

  try {
    const canal = await client.channels.fetch(canalId);
    const embed = new EmbedBuilder()
      .setDescription(mensagens[hora])
      .setColor(hora === "23" ? 0xFF0000 : 0xFF85A2);

    const msg = await canal.send({
      content: `<@${matheusId}> <@${hyandroId}>`,
      embeds: [embed],
      files: [`./assets/terapia-${hora}h.gif`]
    });

    // Emojis de reação
    await msg.react("☕");  // Pago (Matheus)
    await msg.react("🍵");  // Confirmado (Hyandro)
    await msg.react("😤");  // Lembrar depois

    // Configuração do coletor
    const collector = msg.createReactionCollector({
      filter: async (reaction, user) => {
        // Ignora bots
        if (user.bot) return false;
        
        // Verifica se é um usuário autorizado
        const usuarioAutorizado = [hyandroId, matheusId].includes(user.id);
        
        // Verifica emoji válido para o usuário
        const emojiValido = (
          (user.id === matheusId && ["☕", "😤"].includes(reaction.emoji.name)) ||
          (user.id === hyandroId && ["🍵", "😤"].includes(reaction.emoji.name))
        );
        
        return usuarioAutorizado && emojiValido;
      },
      time: 12 * 60 * 60 * 1000 // 12 horas
    });

    collector.on("collect", async (reaction, user) => {
      const novoEstado = {
        ...JSON.parse(fs.readFileSync(controlePath, 'utf8')),
        ultimoPagamento: moment().toISOString(),
        registradoPor: `reação ${reaction.emoji.name} (${user.username})`,
        semana: moment().format("YYYY-WW")
      };

      if (reaction.emoji.name === "☕") {
        // Matheus marcou como pago
        novoEstado.pago = true;
        await canal.send(`⚠️ <@${hyandroId}>, Matheus marcou como pago - confirme com 🍵`);
      } 
      else if (reaction.emoji.name === "🍵") {
        // Hyandro confirmou o pagamento
        novoEstado.pago = true;
        novoEstado.confirmado = true;
        await canal.send("✅ **Pagamento CONFIRMADO por Hyandro**");
        collector.stop();
      }
      else if (reaction.emoji.name === "😤") {
        // Adiar
        await canal.send(`⏳ Lembrete adiado por ${user.username}`);
      }

      fs.writeFileSync(controlePath, JSON.stringify(novoEstado, null, 2));
    });

    collector.on("end", (collected, reason) => {
      console.log(`⏹ Coletor encerrado (${collected.size} reações, motivo: ${reason})`);
    });

  } catch (error) {
    console.error(`❌ Erro no lembrete (${hora}h):`, error);
  }
}

module.exports = { iniciarLembretesTerapia };

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
const controlePath = path.join(__dirname, "../data/controleFaculdade.json");

// Inicialização do arquivo
if (!fs.existsSync(controlePath)) {
  fs.writeFileSync(controlePath, JSON.stringify({ 
    pago: false,
    confirmado: false,
    ultimoPagamento: null,
    registradoPor: null,
    mes: moment().format("YYYY-MM")
  }));
}

const mensagens = {
  "09": `💉 **Alerta matinal!** (Injeção)\n"Matheus, o boleto da faculdade está vencendo! Hora de imunizar sua conta!"`,
  "13": `🩺 **Hora do almoço!** (Estetoscópio)\n"O pagamento da faculdade precisa de sua atenção - injete os recursos necessários!"`,
  "19": `🧪 **Plantão noturno!** (Tubo de ensaio)\n"Matheus, último chamado para aplicar a dose de pagamento!"`,
  "23": `🚨 **EMERGÊNCIA!** (Sirene)\n"ALERTA DE VENCIMENTO! Aplicação de pagamento URGENTE necessária!"`
};

function iniciarLembretesFaculdade(client) {
  // Reset mensal no dia 13 às 00:01
  cron.schedule("1 0 13 * *", () => {
    fs.writeFileSync(controlePath, JSON.stringify({ 
      pago: false,
      confirmado: false,
      ultimoPagamento: null,
      registradoPor: "reset automático",
      mes: moment().format("YYYY-MM")
    }));
    console.log("♻️ Reset mensal da faculdade realizado!");
  }, { timezone: "America/Sao_Paulo" });

  // Lembretes diários
  cron.schedule("0 9,13,19,23 * * *", () => {
    const dia = moment().date();
    if (dia >= 13 && dia <= 19) { // Período 13-19 do mês
      enviarLembrete(client, moment().format("HH"));
    }
  }, { timezone: "America/Sao_Paulo" });

  // Comandos manuais
  client.on("messageCreate", async (message) => {
    if (message.content === "!pago-faculdade" && 
        (message.author.id === matheusId || message.author.id === hyandroId)) {
      const novoEstado = {
        pago: true,
        confirmado: message.author.id === hyandroId,
        ultimoPagamento: moment().toISOString(),
        registradoPor: `comando (${message.author.username})`,
        mes: moment().format("YYYY-MM")
      };
      fs.writeFileSync(controlePath, JSON.stringify(novoEstado));
      await message.reply(`✅ Faculdade marcada como ${novoEstado.confirmado ? 'CONFIRMADA' : 'PAGA'}!`);
    }
  });
}

async function enviarLembrete(client, hora) {
  let controle;
  try {
    controle = JSON.parse(fs.readFileSync(controlePath, 'utf8'));
    if (controle.pago && controle.confirmado && controle.mes === moment().format("YYYY-MM")) {
      return console.log("⏭️ Faculdade já paga este mês");
    }
  } catch (err) {
    console.error("Erro ao ler arquivo:", err);
    controle = { pago: false, confirmado: false, mes: moment().format("YYYY-MM") };
  }

  try {
    const canal = await client.channels.fetch(canalId);
    const embed = new EmbedBuilder()
      .setColor(hora === "23" ? "#FF0000" : "#A7D3F3")
      .setDescription(mensagens[hora])
      .setImage(`attachment://faculdade-${hora}h.gif`);

    const msg = await canal.send({
      content: `<@${matheusId}> <@${hyandroId}>`,
      embeds: [embed],
      files: [`./assets/faculdade-${hora}h.gif`]
    });

    // Emojis de reação
    await msg.react("💉");  // Pago (Matheus)
    await msg.react("🩹");  // Confirmado (Hyandro)
    await msg.react("🦠");  // Lembrar depois

    const collector = msg.createReactionCollector({
      filter: async (reaction, user) => {
        if (user.bot) return false;
        return [hyandroId, matheusId].includes(user.id) && 
               ["💉", "🩹", "🦠"].includes(reaction.emoji.name);
      },
      time: 12 * 60 * 60 * 1000 // 12 horas
    });

    collector.on("collect", async (reaction, user) => {
      const novoEstado = {
        pago: reaction.emoji.name !== "🦠",
        confirmado: reaction.emoji.name === "🩹",
        ultimoPagamento: moment().toISOString(),
        registradoPor: `reação ${reaction.emoji.name} (${user.username})`,
        mes: moment().format("YYYY-MM")
      };

      if (reaction.emoji.name === "💉") {
        await canal.send("💊 Pagamento aplicado! Aguardando confirmação...");
      } 
      else if (reaction.emoji.name === "🩹") {
        await canal.send("✅ **Pagamento CONFIRMADO!** A faculdade está imunizada!");
        collector.stop();
      }
      else if (reaction.emoji.name === "🦠") {
        await canal.send("🦠 A infecção do boleto continua... cuidado com a multa!");
      }

      fs.writeFileSync(controlePath, JSON.stringify(novoEstado));
    });

    collector.on("end", (collected, reason) => {
      console.log(`Coletor faculdade encerrado (${reason})`);
    });

  } catch (error) {
    console.error(`Erro no lembrete faculdade (${hora}h):`, error);
  }
}

module.exports = { iniciarLembretesFaculdade };

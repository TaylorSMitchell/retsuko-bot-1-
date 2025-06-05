const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { EmbedBuilder } = require("discord.js");

moment.tz.setDefault("America/Sao_Paulo");

// Configurações
const canalId = "1377761471148199946";
const hyandroId = "759635802816512041";
const matheusId = "866805922835464233";
const controlePath = path.join(__dirname, "../data/controleFaculdade.json");

const mensagens = {
  "09": `🩸 **Alerta matinal!** (Célula vermelha)\nMatheus, o boleto da faculdade tá circulando no sistema! 🚨`,
  13: `🧪 **Hora do almoço!** (Macrófago sorridente)\nA fatura ainda tá viva... que tal eliminar essa ameaça com um pagamento? 💉`,
  19: `🧬 **Plantão noturno!** (Células brancas atentas)\nMatheus, o sistema precisa da sua ajuda! A faculdade não vai se pagar sozinha! 🧻`,
};

function iniciarLembretesFaculdade(client) {
  // Reset mensal no dia 13, 00:01
  cron.schedule("1 0 13 * *", () => {
    fs.writeFileSync(controlePath, JSON.stringify({ pago: false }));
    console.log("♻️ Reset mensal da faculdade feito!");
  });

  // Lembretes diários entre 13 e 19 às 9h, 13h e 19h
  cron.schedule(
    "0 9,13,19 13-19 * *",
    () => {
      const dia = moment().date();
      const hora = moment().format("HH");
      enviarLembreteFaculdade(client, hora, dia);
    },
    { timezone: "America/Sao_Paulo" },
  );
}

async function enviarLembreteFaculdade(client, hora, dia) {
  let controle = { pago: false };
  try {
    controle = JSON.parse(fs.readFileSync(controlePath, "utf8"));
  } catch {
    // arquivo não existe ainda, ou inválido, segue com pago: false
  }

  if (controle.pago) return;

  const canal = await client.channels.fetch(canalId);
  const mensagemBase =
    dia === 19
      ? `🧨 **EMERGÊNCIA!** (Estilo Cells at Work)\nMatheus, é dia 19! Se não pagar agora, o caos celular vai começar! 😱💥`
      : mensagens[hora];

  const embed = new EmbedBuilder()
    .setColor(dia === 19 ? "#FF0000" : "#A7D3F3")
    .setDescription(mensagemBase)
    .setImage(`attachment://faculdade-${hora}.gif`);

  const msg = await canal.send({
    content: `<@${matheusId}> <@${hyandroId}>`,
    embeds: [embed],
    files: [`./assets/gifs/faculdade-${hora}.gif`],
  });

  await msg.react("🧬"); // Pago
  await msg.react("🦠"); // Lembrar depois

  const collector = msg.createReactionCollector({
    filter: (reaction, user) =>
      user.id === matheusId && ["🧬", "🦠"].includes(reaction.emoji.name),
    time: 3600000, // 1 hora
  });

  collector.on("collect", async (reaction) => {
    if (reaction.emoji.name === "🧬") {
      controle.pago = true;
      fs.writeFileSync(controlePath, JSON.stringify(controle));
      await canal.send({
        content: `🧪 As células vermelhas e plaquetinhas agradecem pela vacina do pagamento! Obrigado, Matheus! 🙌`,
        files: [`./assets/gifs/pago-faculdade-${hora}.gif`],
      });
    } else if (reaction.emoji.name === "🦠") {
      await canal.send({
        content: `🦠 Lembrete adiado... mas cuidado, Matheus, as bactérias do boleto não dormem! 👀`,
        files: [`./assets/gifs/depois-faculdade-${hora}.gif`],
      });
    }
  });
}

module.exports = { iniciarLembretesFaculdade };

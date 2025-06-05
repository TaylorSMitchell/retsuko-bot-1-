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
const controlePath = path.join(__dirname, "../data/controleTerapia.json");

// Frases personalizadas por horário
const mensagens = {
  "09": `🌸 **Bom dia, Matheus!** (Retsuko calmamente)\n"Já pensou em pagar a terapia do Hyandro hoje? Ele tá precisando relaxar... 🍵"`,
  13: `🍱 **Hora do almoço!** (Retsuko com fome)\n"Matheus... dá pra pagar a terapia antes que o Hyandro coma meu bento? 🥢👹"`,
  19: `🌙 **Boa noite!** (Retsuko cansada)\n"Matheus... o Hyandro já tá virando um zumbi. Paga a terapia antes que ele morda alguém! ☠️"`,
  23: `🎸 **AAAAAHHHH!** (Retsuko modo metal)\n"MATHEUSSSS! PAGA ESSA TERAPIA AGORA OU EU VOU SURTAR!!! 🔥🎤💢"`,
};

function iniciarLembretesTerapia(client) {
  // Reset semanal toda segunda às 00:01
  cron.schedule("1 0 * * 1", () => {
    fs.writeFileSync(controlePath, JSON.stringify({ pago: false }));
    console.log("♻️ Reset semanal da terapia feito!");
  });

  // Agendamento dos horários 09h, 13h, 19h, 23h
  cron.schedule(
    "0 9,13,19,23 * * *",
    () => {
      const hora = moment().format("HH");
      enviarLembrete(client, hora);
    },
    { timezone: "America/Sao_Paulo" },
  );
}

async function enviarLembrete(client, hora) {
  const controle = JSON.parse(
    fs.readFileSync(controlePath, "utf8") || '{"pago": false}',
  );
  if (controle.pago) return;

  const canal = await client.channels.fetch(canalId);
  const embed = new EmbedBuilder()
    .setColor(hora === "23" ? "#FF0000" : "#FF85A2")
    .setDescription(mensagens[hora])
    .setImage(`attachment://terapia-${hora}h.gif`);

  const msg = await canal.send({
    content: `<@${matheusId}> <@${hyandroId}>`,
    embeds: [embed],
    files: [`./assets/terapia-${hora}h.gif`],
  });

  await msg.react("🦊"); // Emoji raposa = pago
  await msg.react("🐍"); // Emoji cobra = lembrar depois

  // Coletor de reações (1h de duração)
  const collector = msg.createReactionCollector({
    filter: (reaction, user) =>
      user.id === matheusId && ["🦊", "🐍"].includes(reaction.emoji.name),
    time: 3600000,
  });

  collector.on("collect", async (reaction) => {
    if (reaction.emoji.name === "🦊") {
      controle.pago = true;
      fs.writeFileSync(controlePath, JSON.stringify(controle));
      await canal.send({
        content: `🎉 <@${matheusId}> pagou! <@${hyandroId}> pode respirar aliviado... por enquanto!`,
        files: [`./assets/pago-${hora}h.gif`],
      });
    } else if (reaction.emoji.name === "🐍") {
      await canal.send({
        content: `😤 <@${matheusId}> adiou de novo?! <@${hyandroId}> vai ter que segurar a onda...`,
        files: [`./assets/depois-${hora}h.gif`],
      });
    }
  });
}

module.exports = { iniciarLembretesTerapia };

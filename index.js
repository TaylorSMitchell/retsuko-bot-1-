const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const moment = require("moment-timezone");
const TOKEN = process.env.DISCORD_TOKEN;
const { iniciarLembretesTerapia } = require("./utils/lembreteTerapia");
const { iniciarLembretesFaculdade } = require("./utils/lembreteFaculdade");

// --- Configurações ---
const token = process.env.DISCORD_TOKEN;

// --- Configurar timezone padrão ---
moment.tz.setDefault("America/Sao_Paulo");

// --- Inicializar cliente Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Quando o bot estiver pronto ---
client.once("ready", () => {
  console.log(`🤖 Bot Retsuko online como ${client.user.tag}!`);

  // Iniciar lembretes
  iniciarLembretesTerapia(client);
  iniciarLembretesFaculdade(client);
});

// --- Login do bot ---
client.login(TOKEN);

// --- Criar servidor HTTP para UptimeRobot ---
const app = express();

app.get("/", (req, res) => {
  res.send("ok");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

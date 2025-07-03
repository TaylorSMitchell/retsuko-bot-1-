const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
const moment = require("moment-timezone");
require('dotenv').config();

// Configurações
const TOKEN = process.env.DISCORD_TOKEN;
const { iniciarLembretesTerapia } = require("./utils/lembreteTerapia");
const { iniciarLembretesFaculdade } = require("./utils/lembreteFaculdade");

// Timezone
moment.tz.setDefault("America/Sao_Paulo");

// Cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

// Quando o bot estiver pronto
client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag} - ${new Date().toLocaleString('pt-BR')}`);
  
  // Iniciar serviços
  iniciarLembretesTerapia(client);
  iniciarLembretesFaculdade(client);

  // Keep-alive
  setInterval(() => {
    console.log('🔄 Keep-alive', new Date().toLocaleTimeString('pt-BR'));
  }, 5 * 60 * 1000); // 5 minutos
});

// Tratamento de erros
client.on("error", console.error);
process.on("unhandledRejection", console.error);

// Servidor HTTP para UptimeRobot
const app = express();
app.get("/", (req, res) => {
  res.json({
    status: client.isReady() ? "online" : "connecting",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP na porta ${PORT}`);
  client.login(TOKEN).catch(console.error);
});

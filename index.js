const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
const moment = require("moment-timezone");
require('dotenv').config();

// --- Configurações ---
const TOKEN = process.env.DISCORD_TOKEN;
const { iniciarLembretesTerapia } = require("./utils/lembreteTerapia");
const { iniciarLembretesFaculdade } = require("./utils/lembreteFaculdade");

// --- Configurar timezone padrão ---
moment.tz.setDefault("America/Sao_Paulo");

// --- Inicializar cliente Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// --- Servidor HTTP para UptimeRobot ---
const app = express();
app.use(express.json());

// Rota de health check melhorada
app.get("/", (req, res) => {
  const status = client.isReady() ? 'online' : 'connecting';
  res.json({
    status: status,
    bot: client.user?.tag || 'starting',
    lastPing: new Date().toISOString(),
    memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`
  });
});

// --- Sistema de reconexão automática ---
function connectBot() {
  client.login(TOKEN).catch(err => {
    console.error('Falha no login:', err);
    setTimeout(connectBot, 10000); // Tenta novamente após 10 segundos
  });
}

// --- Quando o bot estiver pronto ---
client.once("ready", () => {
  console.log(`🤖 Bot online como ${client.user.tag} - ${new Date().toLocaleString('pt-BR')}`);

  // Iniciar serviços
  iniciarLembretesTerapia(client);
  iniciarLembretesFaculdade(client);

  // Ping automático para evitar sleep
  setInterval(() => {
    console.log('🔄 Keep-alive', new Date().toLocaleTimeString('pt-BR'));
  }, 5 * 60 * 1000); // A cada 5 minutos
});

// --- Tratamento de erros globais ---
process.on('unhandledRejection', error => {
  console.error('Erro não tratado:', error);
});

client.on('disconnect', () => {
  console.log('⚡ Conexão perdida - Reconectando...');
  setTimeout(connectBot, 5000);
});

// --- Iniciar tudo ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
  connectBot(); // Inicia o bot
});

// --- Encerramento limpo ---
process.on('SIGTERM', () => {
  console.log('Encerrando graciosamente...');
  client.destroy();
  process.exit(0);
});

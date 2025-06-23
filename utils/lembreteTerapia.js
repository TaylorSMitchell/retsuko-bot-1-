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

// Garante que o diretório e arquivo de controle existam
function inicializarArquivoControle() {
  const dir = path.dirname(controlePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(controlePath)) {
    salvarEstado({ 
      pago: false,
      ultimoPagamento: null,
      registradoPor: "sistema",
      semana: moment().format("YYYY-WW")
    });
  }
}

// Função robusta para salvar estado
function salvarEstado(estado) {
  try {
    fs.writeFileSync(controlePath, JSON.stringify(estado, null, 2));
    fs.fsyncSync(fs.openSync(controlePath, 'r+')); // Força escrita no disco
    console.log("💾 Estado salvo:", estado);
  } catch (error) {
    console.error("❌ Erro ao salvar estado:", error);
    throw error; // Propaga o erro para tratamento superior
  }
}

// Mensagens personalizadas por horário
const mensagens = {
  "09": `🌸 **Bom dia, Matheus!** (🐰)\n"Já pensou em pagar a terapia do Hyandro hoje? Ele tá precisando relaxar... 🍵"`,
  "13": `🍱 **Hora do almoço!** (🐺)\n"Matheus... dá pra pagar a terapia antes que o Hyandro coma meu bento? 🥢👹"`,
  "19": `🌙 **Boa noite!** (🦍)\n"Matheus... o Hyandro já tá virando um zumbi. Paga a terapia antes que ele morda alguém! ☠️"`,
  "23": `🎸 **AAAAAHHHH!** (🦊🎸)\n"MATHEUSSSS! PAGA ESSA TERAPIA AGORA OU EU VOU SURTAR!!! 🔥🎤💢"`
};

// Função principal para enviar lembretes
async function enviarLembrete(client, hora) {
  // Carrega o estado com tratamento de erros robusto
  let estado;
  try {
    const dados = fs.readFileSync(controlePath, 'utf8');
    estado = JSON.parse(dados);
    console.log(`🔍 Estado carregado (${hora}h):`, estado);
    
    // Verificação de consistência
    if (estado.pago === true && estado.semana === moment().format("YYYY-WW")) {
      console.log("⏭️ Já pago esta semana - lembrete cancelado");
      return;
    }
  } catch (error) {
    console.error("⚠️ Erro ao ler estado, usando padrão:", error);
    estado = { pago: false, semana: moment().format("YYYY-WW") };
  }

  try {
    const canal = await client.channels.fetch(canalId);
    const embed = new EmbedBuilder()
      .setColor(hora === "23" ? "#FF0000" : "#FF85A2")
      .setDescription(mensagens[hora])
      .setImage(`attachment://terapia-${hora}h.gif`);

    const msg = await canal.send({
      content: `<@${matheusId}> <@${hyandroId}>`,
      embeds: [embed],
      files: [`./assets/terapia-${hora}h.gif`]
    });

    await msg.react("☕");
    await msg.react("😤");

    // Coletor de reações com timeout de 12 horas
    const collector = msg.createReactionCollector({
      filter: async (reaction, user) => {
        if (user.bot) return false;
        console.log(`🔹 Reação recebida: ${reaction.emoji.name} de ${user.tag}`);
        
        try {
          if (reaction.partial) await reaction.fetch();
          if (user.partial) await user.fetch();
          return user.id === matheusId && ["☕", "😤"].includes(reaction.emoji.name);
        } catch (err) {
          console.error("Erro ao processar reação:", err);
          return false;
        }
      },
      time: 43_200_000 // 12 horas
    });

    console.log(`⏳ Coletor iniciado em ${moment().format("HH:mm:ss")} (dura 12h)`);

    collector.on("collect", async (reaction, user) => {
      console.log(`✅ Reação "${reaction.emoji.name}" registrada de ${user.tag}`);
      
      if (reaction.emoji.name === "☕") {
        const novoEstado = {
          pago: true,
          ultimoPagamento: moment().toISOString(),
          registradoPor: "reação ☕",
          semana: moment().format("YYYY-WW")
        };
        
        salvarEstado(novoEstado);
        
        await canal.send({
          content: `🎉 <@${matheusId}> pagou! <@${hyandroId}> pode respirar aliviado... por enquanto!`,
          files: [`./assets/pago-${hora}h.gif`]
        });
        
        collector.stop("pagamento confirmado");
      } else if (reaction.emoji.name === "😤") {
        await canal.send({
          content: `😤 <@${matheusId}> adiou de novo?! <@${hyandroId}> vai ter que segurar a onda...`,
          files: [`./assets/depois-${hora}h.gif`]
        });
        collector.stop("adiado");
      }
    });

    collector.on("end", (collected, reason) => {
      console.log(`⏹ Coletor encerrado (${collected.size} reações, motivo: ${reason})`);
    });

  } catch (error) {
    console.error(`❌ Erro crítico ao enviar lembrete (${hora}h):`, error);
  }
}

// Reset semanal e comandos manuais
function iniciarLembretesTerapia(client) {
  inicializarArquivoControle();

  // Reset automático toda segunda-feira às 00:01
  cron.schedule("1 0 * * 1", () => {
    const novoEstado = {
      pago: false,
      ultimoPagamento: null,
      registradoPor: "reset automático",
      semana: moment().format("YYYY-WW")
    };
    salvarEstado(novoEstado);
    console.log("♻️ Reset semanal realizado:", novoEstado);
  }, {
    timezone: "America/Sao_Paulo"
  });

  // Agendamento dos lembretes
  cron.schedule("0 9,13,19,23 * * *", () => {
    const hora = moment().format("HH");
    console.log(`⏰ Disparando lembrete das ${hora}h`);
    enviarLembrete(client, hora);
  }, {
    timezone: "America/Sao_Paulo"
  });

  // Comandos manuais para administração
  client.on("messageCreate", async (message) => {
    if (message.author.id !== matheusId) return;

    if (message.content === "!pago") {
      const novoEstado = {
        pago: true,
        ultimoPagamento: moment().toISOString(),
        registradoPor: "comando !pago",
        semana: moment().format("YYYY-WW")
      };
      salvarEstado(novoEstado);
      await message.reply("✅ Terapia marcada como **PAGA** para esta semana!");
    }

    if (message.content === "!status") {
      const estado = JSON.parse(fs.readFileSync(controlePath, 'utf8'));
      const status = estado.pago ? "✅ PAGA" : "❌ PENDENTE";
      await message.reply(`**Status da terapia:** ${status}\n` +
        `Último pagamento: ${estado.ultimoPagamento || "Nunca"}\n` +
        `Semana atual: ${estado.semana}`);
    }
  });
}

module.exports = { iniciarLembretesTerapia };

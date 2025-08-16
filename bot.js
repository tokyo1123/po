import 'dotenv/config';
import mineflayer from 'mineflayer';
import { Client, GatewayIntentBits, Partials, SlashCommandBuilder, Routes } from 'discord.js';
import { REST } from '@discordjs/rest';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import fetch from 'node-fetch';

// ================== إعدادات ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const discordToken = process.env.DISCORD_TOKEN;
const discordChannelId = process.env.DISCORD_CHANNEL_ID;
const AUTO_REPLY_CHANNEL = process.env.AUTO_REPLY_CHANNEL;
const COMMAND_CHANNEL = process.env.COMMAND_CHANNEL;
const GEMINI_KEY = process.env.GEMINI_KEY;

// ================== Gemini AI ==================
async function askGemini(content) {
  try {
    const res = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You are a helpful assistant. Reply in same language as user.` },
          { role: 'user', content }
        ]
      },
      { headers: { Authorization: `Bearer ${GEMINI_KEY}` }, timeout: 30000 }
    );
    return res.data?.choices?.[0]?.message?.content || '❌ No response';
  } catch (err) {
    console.error('Gemini error:', err.response?.data || err.message);
    return '❌ Error connecting to Gemini API.';
  }
}

// ================== Web Control Panel ==================
app.get('/', (req, res) => {
  res.sendFile('panel.html', { root: './' });
});

// ================== Minecraft Bot ==================
let bot = null;
let botReady = false;
let autoMessageInterval = null;
let autoMoveInterval = null;
let sendMinecraftToDiscord = false;
let messageQueue = [];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function walkForwardBackward() {
  if (!bot || !bot.entity) return;
  bot.setControlState('forward', true);
  await sleep(15000);
  bot.setControlState('forward', false);
  bot.setControlState('back', true);
  await sleep(15000);
  bot.setControlState('back', false);
}

function logMsg(msg, type='system') {
  console.log(msg);
  io.emit('log', { message: msg, type });
}

function createBot() {
  bot = mineflayer.createBot({
    host: 'ITACHICRB.aternos.me',
    port: 40355,
    username: 'TOKyodot',
    version: '1.21.4',
    connectTimeout: 60000,
    keepAlive: true
  });

  botReady = false;

  bot.once('login', () => {
    logMsg(`✅ Minecraft bot logged in as ${bot.username}`);
    botReady = true;

    while(messageQueue.length > 0){
      bot.chat(messageQueue.shift());
    }

    if(!autoMessageInterval) autoMessageInterval = setInterval(()=>{ 
      if(bot.chat) bot.chat('Welcome! Join Discord: https://discord.gg/E4XpZeywAJ'); 
      logMsg('📢 Auto-message sent'); 
    }, 15*60*1000);

    if(!autoMoveInterval) autoMoveInterval = setInterval(walkForwardBackward, 30000);
    io.emit('status', { text: 'Online', online: true });
  });

  bot.on('chat', async (username, message) => {
    logMsg(`<${username}> ${message}`, 'chat');

    if(sendMinecraftToDiscord && discordClient.isReady() && discordChannelId){
      try {
        const channel = await discordClient.channels.fetch(discordChannelId);
        if(channel && channel.isTextBased()){
          await channel.send(`**[Minecraft]** <${username}> ${message}`);
        } else {
          logMsg('❌ Discord channel not text-based or not found', 'error');
        }
      } catch(err){
        logMsg(`❌ Failed to send Minecraft message to Discord: ${err}`, 'error');
      }
    }
  });

  bot.on('end', ()=>{
    logMsg('⚠️ Minecraft bot disconnected', 'error');
    botReady = false;
    clearInterval(autoMessageInterval); 
    clearInterval(autoMoveInterval);
    autoMessageInterval=null; 
    autoMoveInterval=null;
    io.emit('status', { text: 'Offline', online: false });
    setTimeout(createBot, 5000);
  });

  bot.on('error', err => logMsg(`❌ Minecraft error: ${err}`, 'error'));
}

// ================== Discord Bot ==================
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const DEFAULTS = { width: 768, height: 768, model: 'flux', seed: 0, nologo: true, enhance: false };
function buildImageUrl(prompt, opts={}) {
  const q = new URLSearchParams({
    width: opts.width||DEFAULTS.width,
    height: opts.height||DEFAULTS.height,
    model: opts.model||DEFAULTS.model,
    seed: opts.seed||DEFAULTS.seed,
    nologo: (opts.nologo ?? DEFAULTS.nologo) ? 'true' : 'false',
    enhance: (opts.enhance ?? DEFAULTS.enhance) ? 'true' : 'false'
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q.toString()}`;
}

// ================== Slash Commands ==================
const commands = [
  new SlashCommandBuilder().setName('gn').setDescription('Generate an image').addStringOption(opt=>opt.setName('prompt').setDescription('Image description').setRequired(true)).toJSON(),
  new SlashCommandBuilder().setName('start').setDescription('Start Minecraft bot').toJSON(),
  new SlashCommandBuilder().setName('stop').setDescription('Stop Minecraft bot').toJSON(),
  new SlashCommandBuilder().setName('rs').setDescription('Restart Minecraft bot').toJSON(),
  new SlashCommandBuilder().setName('pn').setDescription('Toggle sending Minecraft chat to Discord').toJSON(),
  new SlashCommandBuilder().setName('ping').setDescription('Check system status').toJSON()
];

discordClient.once('ready', async ()=>{
  console.log(`✅ Logged in as ${discordClient.user.tag}`);
  const rest = new REST({ version:'10' }).setToken(discordToken);
  try { 
    await rest.put(Routes.applicationGuildCommands(discordClient.user.id, process.env.GUILD_ID), { body: commands }); 
    console.log('📌 All slash commands registered'); 
  } catch(e){ console.error(e); }
});

// ================== Slash Command Handling ==================
discordClient.on('interactionCreate', async interaction=>{
  if(!interaction.isChatInputCommand()) return;
  const name = interaction.commandName;

  // التحقق من القناة المسموح فيها الأوامر
  if(interaction.channelId !== COMMAND_CHANNEL && interaction.channelId !== discordChannelId && !interaction.channel?.isDMBased()){
    return interaction.reply({ content:'❌ هذا الأمر غير مسموح هنا.', flags: 64 });
  }

  if(name==='gn'){
    const prompt = interaction.options.getString('prompt');
    await interaction.deferReply();
    try{
      const imageUrl = buildImageUrl(prompt);
      const res = await fetch(imageUrl);
      const buffer = await res.arrayBuffer();
      await interaction.editReply({ files:[{ attachment: Buffer.from(buffer), name:'image.png'}] });
    } catch(e){ await interaction.editReply('❌ Error generating image'); }
  }
  else if(name==='start'){ 
    if(!bot){ createBot(); await interaction.reply('Minecraft bot started'); } 
    else await interaction.reply('Bot already running'); 
  }
  else if(name==='stop'){ 
    if(bot){ bot.quit('Stopped via Discord'); bot=null; botReady=false; clearInterval(autoMessageInterval); clearInterval(autoMoveInterval); autoMessageInterval=null; autoMoveInterval=null; await interaction.reply('Minecraft bot stopped'); } 
    else await interaction.reply('Bot not running'); 
  }
  else if(name==='rs'){ 
    if(bot){ bot.quit('Restarting...'); bot=null; botReady=false; clearInterval(autoMessageInterval); clearInterval(autoMoveInterval); autoMessageInterval=null; autoMoveInterval=null; setTimeout(()=>{createBot();},3000); await interaction.reply('Minecraft bot restarting...'); } 
    else await interaction.reply('Bot not running'); 
  }
  else if(name==='pn'){ 
    // السماح بأمر /pn فقط في القناة المخصصة لربط Minecraft → Discord
    if(interaction.channelId !== discordChannelId){
      return interaction.reply({ content:'❌ أمر /pn مسموح فقط في القناة المخصصة لربط Minecraft → Discord', flags: 64 });
    }
    sendMinecraftToDiscord = !sendMinecraftToDiscord; 
    await interaction.reply(sendMinecraftToDiscord?'📩 Minecraft messages enabled':'🚫 Minecraft messages disabled'); 
  }
  else if(name==='ping'){ 
    await interaction.reply(`📊 Status:\n- Discord: ${discordClient.isReady()?'✅':'❌'}\n- Minecraft: ${botReady?'✅':'❌'}`); 
  }
});

// ================== Discord → Minecraft & Gemini Auto-reply ==================
discordClient.on('messageCreate', async message => {
  if(message.author.bot) return;

  // Relay to Minecraft
  if(message.channel.id === discordChannelId){
    if(bot && botReady){
      bot.chat(message.content);
      logMsg(`[Discord → Minecraft] ${message.author.username}: ${message.content}`, 'chat');
    } else {
      messageQueue.push(message.content);
      logMsg(`[Discord → Minecraft] Message queued: ${message.content}`, 'system');
    }
  }

  // Gemini Auto-reply
  if(message.channel.id === AUTO_REPLY_CHANNEL || message.channel.type === 1){
    const answer = await askGemini(message.content);
    message.reply(answer.slice(0,1900));
  }
});

// ================== Web Panel Socket.IO ==================
io.on('connection', socket => {
  logMsg('💻 Web panel connected');
  socket.emit('status', { text: botReady ? 'Online' : 'Offline', online: botReady });

  socket.on('getStatus', () => {
    socket.emit('status', { text: botReady ? 'Online' : 'Offline', online: botReady });
  });

  socket.on('sendMessage', msg => {
    if(bot && botReady){
      bot.chat(msg);
      logMsg(`[Web] ${msg}`, 'chat');
    } else {
      messageQueue.push(msg);
      logMsg(`[Web] Message queued: ${msg}`, 'system');
    }
  });

  socket.on('control', async action => {
    switch(action){
      case 'start':
        if(!bot){ createBot(); logMsg('🌟 Bot started via panel'); } else logMsg('⚠️ Bot already running'); break;
      case 'stop':
        if(bot){ bot.quit('Stopped via panel'); bot=null; botReady=false; clearInterval(autoMessageInterval); clearInterval(autoMoveInterval); autoMessageInterval=null; autoMoveInterval=null; logMsg('🛑 Bot stopped via panel'); } else logMsg('⚠️ Bot not running'); break;
      case 'restart':
        if(bot){ bot.quit('Restarting via panel'); bot=null; botReady=false; clearInterval(autoMessageInterval); clearInterval(autoMoveInterval); autoMessageInterval=null; autoMoveInterval=null; logMsg('🔄 Bot restarting via panel...'); setTimeout(()=>createBot(),3000); } else logMsg('⚠️ Bot not running'); break;
    }
    io.emit('status', { text: botReady ? 'Online' : 'Offline', online: botReady });
  });
});

// ================== Start Servers ==================
server.listen(PORT, ()=>console.log(`🌐 Web server running on port ${PORT}`));
discordClient.login(discordToken);

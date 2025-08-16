import 'dotenv/config';
import mineflayer from 'mineflayer';
import { Client, GatewayIntentBits, Partials, SlashCommandBuilder, Routes, ChannelType } from 'discord.js';
import { REST } from '@discordjs/rest';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import fetch from 'node-fetch';

// ================== إعدادات ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});
const PORT = process.env.PORT || 3000;

const discordToken = process.env.DISCORD_TOKEN;
const discordChannelId = process.env.DISCORD_CHANNEL_ID;
const AUTO_REPLY_CHANNEL = process.env.AUTO_REPLY_CHANNEL;
const COMMAND_CHANNEL = process.env.COMMAND_CHANNEL;
const GEMINI_KEY = process.env.GEMINI_KEY;
const GUILD_ID = process.env.GUILD_ID;

// تحذيرات مفيدة بدل الكراش المباشر
if (!discordToken) console.warn('⚠️  DISCORD_TOKEN غير معرّف في Environment Variables');
if (!GUILD_ID) console.warn('⚠️  GUILD_ID غير معرّف. سيتم التسجيل عالميًا بدل تسجيل أوامر السيرفر.');
if (!discordChannelId) console.warn('⚠️  DISCORD_CHANNEL_ID غير معرّف. ميزات الربط Minecraft ↔ Discord قد لا تعمل.');
if (!AUTO_REPLY_CHANNEL) console.warn('⚠️  AUTO_REPLY_CHANNEL غير معرّف. ميزة الرد التلقائي قد لا تعمل.');
if (!COMMAND_CHANNEL) console.warn('⚠️  COMMAND_CHANNEL غير معرّف. فلترة أماكن تنفيذ الأوامر قد تكون أضعف.');
if (!GEMINI_KEY) console.warn('⚠️  GEMINI_KEY غير معرّف. الردود عبر Gemini ستفشل.');

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
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TOKyodot Bot Control</title>
      <style>
        :root {
          --primary: #5865F2;
          --dark: #1e1f22;
          --darker: #111214;
          --light: #f2f3f5;
          --success: #3ba55c;
          --danger: #ed4245;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background-color: var(--darker); color: var(--light); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { background: linear-gradient(135deg, var(--primary), #9147ff); padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); display: flex; justify-content: space-between; align-items: center; }
        h1 { font-size: 24px; font-weight: 600; }
        .status { background-color: var(--dark); padding: 5px 10px; border-radius: 4px; font-size: 14px; }
        .status.online { color: var(--success); }
        .status.offline { color: var(--danger); }
        .panel { display: flex; gap: 20px; margin-bottom: 20px; }
        .log-container { flex: 1; background-color: var(--dark); border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); height: 500px; overflow: hidden; display: flex; flex-direction: column; }
        .logs { flex: 1; overflow-y: auto; padding: 10px; background-color: #2b2d31; border-radius: 4px; margin-bottom: 15px; font-family: 'Consolas', monospace; }
        .log-entry { margin-bottom: 5px; line-height: 1.4; word-break: break-word; }
        .log-entry.system { color: #949cf7; }
        .log-entry.chat { color: #dbdee1; }
        .log-entry.error { color: #f04747; }
        .input-group { display: flex; gap: 10px; }
        input { flex: 1; padding: 10px 15px; border: none; border-radius: 4px; background-color: #383a40; color: var(--light); font-size: 14px; }
        input:focus { outline: none; box-shadow: 0 0 0 2px var(--primary); }
        button { padding: 10px 20px; background-color: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: background-color 0.2s; }
        button:hover { background-color: #4752c4; }
        button:active { background-color: #3a45a5; }
        .controls { width: 300px; background-color: var(--dark); border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .control-title { font-size: 16px; font-weight: 600; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #383a40; }
        .control-buttons { display: flex; flex-direction: column; gap: 10px; }
        .control-btn { padding: 10px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500; transition: all 0.2s; }
        .start-btn { background-color: var(--success); color: white; }
        .stop-btn { background-color: var(--danger); color: white; }
        .restart-btn { background-color: #faa61a; color: white; }
        .timestamp { color: #a3a6aa; font-size: 12px; margin-right: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>TOKyodot Bot Control Panel</h1>
          <div class="status" id="connection-status">Loading...</div>
        </header>
        
        <div class="panel">
          <div class="log-container">
            <div class="logs" id="logs"></div>
            <div class="input-group">
              <input type="text" id="msg" placeholder="Type a message to send in Minecraft..." autocomplete="off" />
              <button id="send-btn">Send</button>
            </div>
          </div>
          
          <div class="controls">
            <div class="control-title">Bot Controls</div>
            <div class="control-buttons">
              <button class="control-btn start-btn" id="start-btn">Start Bot</button>
              <button class="control-btn stop-btn" id="stop-btn">Stop Bot</button>
              <button class="control-btn restart-btn" id="restart-btn">Restart Bot</button>
            </div>
          </div>
        </div>
      </div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const logs = document.getElementById('logs');
        const msgInput = document.getElementById('msg');
        const sendBtn = document.getElementById('send-btn');
        const statusElement = document.getElementById('connection-status');
        
        // Elements for control buttons
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const restartBtn = document.getElementById('restart-btn');
        
        function getTimestamp() {
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const seconds = now.getSeconds().toString().padStart(2, '0');
          return \`\${hours}:\${minutes}:\${seconds}\`;
        }
        
        function addLog(msg, type = 'system') {
          const logEntry = document.createElement('div');
          logEntry.className = \`log-entry \${type}\`;
          logEntry.innerHTML = \`<span class="timestamp">\${getTimestamp()}</span>\${msg}\`;
          logs.appendChild(logEntry);
          logs.scrollTop = logs.scrollHeight;
        }
        
        socket.on('log', (data) => {
          addLog(data.message, data.type || 'system');
        });
        
        socket.on('status', (status) => {
          statusElement.textContent = status.text;
          statusElement.className = \`status \${status.online ? 'online' : 'offline'}\`;
        });
        
        function sendMessage() {
          const msg = msgInput.value.trim();
          if (msg) {
            socket.emit('sendMessage', msg);
            addLog(\`[You] \${msg}\`, 'chat');
            msgInput.value = '';
          }
        }
        
        sendBtn.addEventListener('click', sendMessage);
        msgInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') sendMessage();
        });
        
        startBtn.addEventListener('click', () => socket.emit('control', 'start'));
        stopBtn.addEventListener('click', () => socket.emit('control', 'stop'));
        restartBtn.addEventListener('click', () => socket.emit('control', 'restart'));
        
        socket.emit('getStatus');
      </script>
    </body>
    </html>
  `);
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

    if(sendMinecraftToDiscord && isDiscordReady() && discordChannelId){
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

// helper آمن لفحص الجاهزية
function isDiscordReady() {
  return !!discordClient.user;
}

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
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(discordClient.user.id, GUILD_ID), { body: commands }); 
      console.log('📌 All slash commands registered (Guild)');
    } else {
      await rest.put(Routes.applicationCommands(discordClient.user.id), { body: commands });
      console.log('📌 All slash commands registered (Global fallback)');
    }
  } catch(e){ 
    console.error('❌ Failed to register slash commands:', e?.message || e); 
  }
});

// ================== Slash Command Handling ==================
discordClient.on('interactionCreate', async interaction=>{
  if(!interaction.isChatInputCommand()) return;
  const name = interaction.commandName;

  // التحقق من القناة المسموح فيها الأوامر
  if(
    interaction.channelId !== COMMAND_CHANNEL &&
    interaction.channelId !== discordChannelId &&
    !interaction.channel?.isDMBased()
  ){
    return interaction.reply({ content:'❌ هذا الأمر غير مسموح هنا.', ephemeral: true });
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
    if(bot){ 
      bot.quit('Stopped via Discord'); 
      bot=null; 
      botReady=false; 
      clearInterval(autoMessageInterval); 
      clearInterval(autoMoveInterval); 
      autoMessageInterval=null; 
      autoMoveInterval=null; 
      await interaction.reply('Minecraft bot stopped'); 
    } else await interaction.reply('Bot not running'); 
  }
  else if(name==='rs'){ 
    if(bot){ 
      bot.quit('Restarting...'); 
      bot=null; 
      botReady=false; 
      clearInterval(autoMessageInterval); 
      clearInterval(autoMoveInterval); 
      autoMessageInterval=null; 
      autoMoveInterval=null; 
      setTimeout(()=>{createBot();},3000); 
      await interaction.reply('Minecraft bot restarting...'); 
    } else await interaction.reply('Bot not running'); 
  }
  else if(name==='pn'){ 
    // السماح بأمر /pn فقط في القناة المخصصة لربط Minecraft → Discord
    if(interaction.channelId !== discordChannelId){
      return interaction.reply({ content:'❌ أمر /pn مسموح فقط في القناة المخصصة لربط Minecraft → Discord', ephemeral: true });
    }
    sendMinecraftToDiscord = !sendMinecraftToDiscord; 
    await interaction.reply(sendMinecraftToDiscord?'📩 Minecraft messages enabled':'🚫 Minecraft messages disabled'); 
  }
  else if(name==='ping'){ 
    await interaction.reply(`📊 Status:\n- Discord: ${isDiscordReady()?'✅':'❌'}\n- Minecraft: ${botReady?'✅':'❌'}`); 
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

  // Gemini Auto-reply (في القناة المحددة أو في الـ DM)
  if(message.channel.id === AUTO_REPLY_CHANNEL || message.channel.isDMBased() || message.channel.type === ChannelType.DM){
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

// تسجيل أحداث أخطاء عامة لتجنب الإنهاء الصامت
process.on('unhandledRejection', (reason) => console.error('UnhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('UncaughtException:', err));

// تسجيل الدخول لديسكورد في النهاية
discordClient.login(discordToken);

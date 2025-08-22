
import 'dotenv/config';
import mineflayer from 'mineflayer';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
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
const GN_CHANNEL = process.env.GN_CHANNEL; // روم الصور لأمر gn
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
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        body {
          background-color: var(--darker);
          color: var(--light);
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        header {
          background: linear-gradient(135deg, var(--primary), #9147ff);
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        h1 {
          font-size: 24px;
          font-weight: 600;
        }
        .status {
          background-color: var(--dark);
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 14px;
        }
        .status.online {
          color: var(--success);
        }
        .status.offline {
          color: var(--danger);
        }
        .panel {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        .log-container {
          flex: 1;
          background-color: var(--dark);
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          height: 500px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .logs {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: #2b2d31;
          border-radius: 4px;
          margin-bottom: 15px;
          font-family: 'Consolas', monospace;
        }
        .log-entry {
          margin-bottom: 5px;
          line-height: 1.4;
          word-break: break-word;
        }
        .log-entry.system {
          color: #949cf7;
        }
        .log-entry.chat {
          color: #dbdee1;
        }
        .log-entry.error {
          color: #f04747;
        }
        .input-group {
          display: flex;
          gap: 10px;
        }
        input {
          flex: 1;
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          background-color: #383a40;
          color: var(--light);
          font-size: 14px;
        }
        input:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--primary);
        }
        button {
          padding: 10px 20px;
          background-color: var(--primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          transition: background-color 0.2s;
        }
        button:hover {
          background-color: #4752c4;
        }
        button:active {
          background-color: #3a45a5;
        }
        .controls {
          width: 300px;
          background-color: var(--dark);
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .control-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #383a40;
        }
        .control-buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .control-btn {
          padding: 10px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .start-btn {
          background-color: var(--success);
          color: white;
        }
        .stop-btn {
          background-color: var(--danger);
          color: white;
        }
        .restart-btn {
          background-color: #faa61a;
          color: white;
        }
        .timestamp {
          color: #a3a6aa;
          font-size: 12px;
          margin-right: 8px;
        }
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
        
        // Format timestamp
        function getTimestamp() {
          const now = new Date();
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const seconds = now.getSeconds().toString().padStart(2, '0');
          return \`\${hours}:\${minutes}:\${seconds}\`;
        }
        
        // Add log message
        function addLog(msg, type = 'system') {
          const logEntry = document.createElement('div');
          logEntry.className = \`log-entry \${type}\`;
          logEntry.innerHTML = \`<span class="timestamp">\${getTimestamp()}</span>\${msg}\`;
          logs.appendChild(logEntry);
          logs.scrollTop = logs.scrollHeight;
        }
        
        // Socket events
        socket.on('log', (data) => {
          addLog(data.message, data.type || 'system');
        });
        
        socket.on('status', (status) => {
          statusElement.textContent = status.text;
          statusElement.className = \`status \${status.online ? 'online' : 'offline'}\`;
        });
        
        // Send message function
        function sendMessage() {
          const msg = msgInput.value.trim();
          if (msg) {
            socket.emit('sendMessage', msg);
            addLog(\`[You] \${msg}\`, 'chat');
            msgInput.value = '';
          }
        }
        
        // Event listeners
        sendBtn.addEventListener('click', sendMessage);
        msgInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') sendMessage();
        });
        
        // Control buttons
        startBtn.addEventListener('click', () => socket.emit('control', 'start'));
        stopBtn.addEventListener('click', () => socket.emit('control', 'stop'));
        restartBtn.addEventListener('click', () => socket.emit('control', 'restart'));
        
        // Initial status
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
    host: '',
    port:' ',
    username: '',
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
      if(bot.chat) bot.chat('Welcome to dla3a! Join Discord: https://discord.gg/RGjpJAXXJ5'); 
      logMsg('📢 Auto-message sent'); 
    }, 15*60*1000);

    if(!autoMoveInterval) autoMoveInterval = setInterval(walkForwardBackward, 30000);
    io.emit('status', { text: 'Online', online: true });
  });

  bot.on('chat', async (username, message) => {
    logMsg(`<${username}> ${message}`, 'chat');

    // ================== *ask Gemini Command ==================
    if(message.startsWith('!ask ')){
      const question = message.slice(5).trim();
      if(question.length > 0){
        bot.chat('⏳ Thinking...');
        const reply = await askGemini(question);
        bot.chat(reply.slice(0,256)); // ماينكرافت الحد الأقصى تقريباً 256 حرف
      }
    }

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

// ================== Discord → Minecraft & Gemini Auto-reply & Commands بالبرفكس * ==================
discordClient.on('messageCreate', async message => {
  if(message.author.bot) return;

  const content = message.content.trim();
  const channelId = message.channel.id;

    // 🎯 لعبة روليت الإقصاء
  else if(cmd === 'روليت' || cmd === 'roulette'){
    const rouletteGif = 'https://i.imgur.com/uL65Qm5.gif';

    // تحقق من أن الأمر في سيرفر وليس في DM
    if(!message.guild){
      return message.reply('❌ لا يمكن تشغيل هذه اللعبة في الخاص!');
    }

    // جلب جميع الأعضاء القابلين للذكر (غير البوتات)
    const members = await message.guild.members.fetch();
    const players = members.filter(m => !m.user.bot);

    if(players.size < 2){
      return message.reply('❌ يجب أن يكون هناك شخصان على الأقل لبدء اللعبة!');
    }

    // إرسال رسالة البدء + GIF
    await message.reply({
      content: '🎯 **الروليت بدأت! من سيكون الضحية؟**',
      files: [rouletteGif]
    });

    // اختيار شخص عشوائي بعد 3 ثوانٍ
    setTimeout(() => {
      const randomMember = players.random();
      message.channel.send(`💥 **تم اختيار:** ${randomMember} \n🚪 **تمت إزالته من اللعبة!**`);
    }, 3000);
  }


  // ================== Minecraft relay ==================
  if(channelId === discordChannelId){
    if(bot && botReady){
      bot.chat(content);
      logMsg(`[Discord → Minecraft] ${message.author.username}: ${content}`, 'chat');
    } else {
      messageQueue.push(content);
      logMsg(`[Discord → Minecraft] Message queued: ${content}`, 'system');
    }
  }

  // ================== Gemini Auto-reply ==================
  if(channelId === AUTO_REPLY_CHANNEL || message.channel.type === 1){
    const answer = await askGemini(content);
    message.reply(answer.slice(0,1900));
  }

  // ================== Commands with * prefix ==================
  if(!content.startsWith('*')) return;
  const args = content.slice(1).split(/ +/);
  const cmd = args.shift().toLowerCase();

  // أمر gn فقط في الروم المخصص
  if(cmd === 'gn'){
    if(channelId !== GN_CHANNEL){
      return message.reply('❌ أمر *gn مسموح فقط في القناة المخصصة للصور');
    }
    const prompt = args.join(' ');
    if(!prompt) return message.reply('❌ يرجى كتابة وصف للصورة');
    try{
      const imageUrl = buildImageUrl(prompt);
      const res = await fetch(imageUrl);
      const buffer = await res.arrayBuffer();
      await message.reply({ files:[{ attachment: Buffer.from(buffer), name:'image.png'}] });
    } catch(e){
      message.reply('❌ Error generating image');
    }
  }

  // أوامر الماينكرافت
  else if(cmd === 'start'){
    if(!bot){ createBot(); message.reply('Minecraft bot started'); } 
    else message.reply('Bot already running'); 
  }
  else if(cmd === 'stop'){
    if(bot){ bot.quit('Stopped via Discord'); bot=null; botReady=false; clearInterval(autoMessageInterval); clearInterval(autoMoveInterval); autoMessageInterval=null; autoMoveInterval=null; message.reply('Minecraft bot stopped'); } 
    else message.reply('Bot not running'); 
  }
  else if(cmd === 'rs'){
    if(bot){ bot.quit('Restarting...'); bot=null; botReady=false; clearInterval(autoMessageInterval); clearInterval(autoMoveInterval); autoMessageInterval=null; autoMoveInterval=null; setTimeout(()=>{createBot();},3000); message.reply('Minecraft bot restarting...'); } 
    else message.reply('Bot not running'); 
  }
  else if(cmd === 'pn'){
    if(channelId !== discordChannelId){
      return message.reply('❌ أمر *pn مسموح فقط في القناة المخصصة لربط Minecraft → Discord');
    }
    sendMinecraftToDiscord = !sendMinecraftToDiscord;
    message.reply(sendMinecraftToDiscord?'📩 Minecraft messages enabled':'🚫 Minecraft messages disabled');
  }
  else if(cmd === 'ping'){
    message.reply(`📊 Status:\n- Discord: ${discordClient.isReady()?'✅':'❌'}\n- Minecraft: ${botReady?'✅':'❌'}`);
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




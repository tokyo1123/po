import 'dotenv/config';
import mineflayer from 'mineflayer';
import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import fetch from 'node-fetch';
import { createCanvas } from 'canvas';

// ================== إعدادات ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const discordToken = process.env.DISCORD_TOKEN;
const discordChannelId = process.env.DISCORD_CHANNEL_ID;
const AUTO_REPLY_CHANNEL = process.env.AUTO_REPLY_CHANNEL;
const COMMAND_CHANNEL = process.env.COMMAND_CHANNEL;
const GN_CHANNEL = process.env.GN_CHANNEL;
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
    host: 'HOSTEL_-server.aternos.me',
    port: '52532',
    username: 'HOSTEL',
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

    if(message.startsWith('!ask ')){
      const question = message.slice(5).trim();
      if(question.length > 0){
        bot.chat('⏳ Thinking...');
        const reply = await askGemini(question);
        bot.chat(reply.slice(0,256));
      }
    }

    if(sendMinecraftToDiscord && discordClient.isReady() && discordChannelId){
      try {
        const channel = await discordClient.channels.fetch(discordChannelId);
        if(channel && channel.isTextBased()){
          await channel.send(`**[Minecraft]** <${username}> ${message}`);
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
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ================== لعبة روليت ==================
const roulettePlayers = new Map();

function getRandomColor() {
  const colors = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#34495e'];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function generateRouletteImage(players) {
  const size = 400;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f3136';
  ctx.fillRect(0, 0, size, size);

  if(players.size === 0){
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText('لا يوجد لاعبين', 120, 200);
    return canvas.toBuffer();
  }

  const total = players.size;
  const anglePer = (Math.PI * 2) / total;
  let startAngle = 0;

  for (const [name, color] of players) {
    const endAngle = startAngle + anglePer;
    ctx.beginPath();
    ctx.moveTo(size/2, size/2);
    ctx.arc(size/2, size/2, size/2, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.save();
    ctx.translate(size/2, size/2);
    ctx.rotate(startAngle + anglePer / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(name, size/2 - 20, 10);
    ctx.restore();

    startAngle = endAngle;
  }

  return canvas.toBuffer();
}

// ================== أوامر الديسكورد ==================
discordClient.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const args = content.split(' ');
  const cmd = args.shift().toLowerCase();
  const channelId = message.channel.id;

  if (cmd === '*ro') {
    const img = await generateRouletteImage(roulettePlayers);
    const attachment = new AttachmentBuilder(img, { name: 'roulette.png' });

    const joinBtn = new ButtonBuilder().setCustomId('join').setLabel('✅ انضم').setStyle(ButtonStyle.Success);
    const leaveBtn = new ButtonBuilder().setCustomId('leave').setLabel('🚪 خروج').setStyle(ButtonStyle.Danger);
    const startBtn = new ButtonBuilder().setCustomId('start').setLabel('🎯 ابدأ').setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn, startBtn);
    await message.channel.send({ content: '🎮 لعبة الروليت بدأت! اضغط للانضمام:', files: [attachment], components: [row] });
  }

  if(cmd === 'gn'){
    if(channelId !== GN_CHANNEL){
      return message.reply('❌ أمر *gn مسموح فقط في القناة المخصصة للصور');
    }
    const prompt = args.join(' ');
    if(!prompt) return message.reply('❌ يرجى كتابة وصف للصورة');
    try{
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
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

// ================== تفاعل الأزرار ==================
discordClient.on('interactionCreate', async interaction => {
  if(!interaction.isButton()) return;

  if(interaction.customId === 'join'){
    if(roulettePlayers.has(interaction.user.username)){
      return interaction.reply({ content: '✅ أنت بالفعل مشارك!', ephemeral: true });
    }
    roulettePlayers.set(interaction.user.username, getRandomColor());
  }

  if(interaction.customId === 'leave'){
    if(!roulettePlayers.has(interaction.user.username)){
      return interaction.reply({ content: '❌ لست مشارك!', ephemeral: true });
    }
    roulettePlayers.delete(interaction.user.username);
  }

  if(interaction.customId === 'start'){
    if(roulettePlayers.size < 2){
      return interaction.reply({ content: '❌ يجب أن يكون هناك شخصان على الأقل!', ephemeral: true });
    }
    const keys = [...roulettePlayers.keys()];
    const loser = keys[Math.floor(Math.random() * keys.length)];
    roulettePlayers.delete(loser);

    const img = await generateRouletteImage(roulettePlayers);
    const attachment = new AttachmentBuilder(img, { name: 'roulette.png' });

    // تقسيم الأزرار إلى صفوف من 5 أزرار
    const rows = [];
    let buttons = [];
    for(const player of roulettePlayers.keys()){
      buttons.push(new ButtonBuilder().setCustomId(`kick_${player}`).setLabel(`🚫 ${player}`).setStyle(ButtonStyle.Secondary));
      if(buttons.length === 5){
        rows.push(new ActionRowBuilder().addComponents(buttons));
        buttons = [];
      }
    }
    if(buttons.length > 0) rows.push(new ActionRowBuilder().addComponents(buttons));

    await interaction.reply({ content: `💥 تم اختيار: **${loser}**\nمن ستقصي؟`, files: [attachment], components: rows });
    return;
  }

  if(interaction.customId.startsWith('kick_')){
    const target = interaction.customId.replace('kick_', '');
    if(!roulettePlayers.has(target)){
      return interaction.reply({ content: '❌ اللاعب غير موجود!', ephemeral: true });
    }
    roulettePlayers.delete(target);

    const img = await generateRouletteImage(roulettePlayers);
    const attachment = new AttachmentBuilder(img, { name: 'roulette.png' });

    await interaction.update({ content: `🚫 تم إقصاء: **${target}**`, files: [attachment], components: [] });
    return;
  }

  // تحديث الصورة بعد أي تغيير (Join / Leave)
  const img = await generateRouletteImage(roulettePlayers);
  const attachment = new AttachmentBuilder(img, { name: 'roulette.png' });
  await interaction.message.edit({ files: [attachment] });
});

discordClient.login(discordToken);

// ================== Web Panel Socket.IO ==================
io.on('connection', socket => {
  logMsg('💻 Web panel connected');
});

server.listen(PORT, ()=>console.log(`🌐 Web server running on port ${PORT}`));


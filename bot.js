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
  res.send(`<h1>TOKyodot Bot Control Panel</h1>`);
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
    port: '',
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

// ================== أوامر ديسكورد ==================
discordClient.on('messageCreate', async message => {
  if(message.author.bot) return;
  const content = message.content.trim();
  const args = content.split(' ');
  const cmd = args.shift().toLowerCase();

  if(cmd === '*ro'){
    const img = await generateRouletteImage(roulettePlayers);
    const attachment = new AttachmentBuilder(img, { name: 'roulette.png' });

    const joinBtn = new ButtonBuilder().setCustomId('join').setLabel('✅ انضم').setStyle(ButtonStyle.Success);
    const leaveBtn = new ButtonBuilder().setCustomId('leave').setLabel('🚪 خروج').setStyle(ButtonStyle.Danger);
    const startBtn = new ButtonBuilder().setCustomId('start').setLabel('🎯 ابدأ').setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn, startBtn);
    await message.channel.send({ content: '🎮 لعبة الروليت بدأت! اضغط للانضمام:', files: [attachment], components: [row] });
  }
});

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

    const buttons = new ActionRowBuilder();
    for(const player of roulettePlayers.keys()){
      buttons.addComponents(new ButtonBuilder().setCustomId(`kick_${player}`).setLabel(`🚫 ${player}`).setStyle(ButtonStyle.Secondary));
    }

    await interaction.reply({ content: `💥 تم اختيار: **${loser}**\nمن ستقصي؟`, files: [attachment], components: [buttons] });
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
  }

  // تحديث الصورة بعد أي تغيير (Join / Leave)
  const img = await generateRouletteImage(roulettePlayers);
  const attachment = new AttachmentBuilder(img, { name: 'roulette.png' });
  await interaction.message.edit({ files: [attachment] });
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

discordClient.login(discordToken);

// ================== Web Panel Socket.IO ==================
io.on('connection', socket => {
  logMsg('💻 Web panel connected');
});

server.listen(PORT, ()=>console.log(`🌐 Web server running on port ${PORT}`));

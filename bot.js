require('dotenv').config();

const mineflayer = require('mineflayer');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

server.listen(3000, () => console.log('🌐 Web server running on port 3000'));

const discordToken = process.env.DISCORD_TOKEN;
const discordChannelId = process.env.DISCORD_CHANNEL_ID;

// Ollama AI Config
const OLLAMA_API_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama2";

async function askAI(question) {
  try {
    const response = await axios.post(
      OLLAMA_API_URL,
      {
        model: OLLAMA_MODEL,
        prompt: question,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.response) {
      return response.data.response.trim();
    }
    return "I couldn't think of an answer.";
  } catch (err) {
    console.error("AI Error:", err.message);
    return "Error fetching AI response.";
  }
}

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let bot = null;
let autoMessageInterval = null;
let autoMoveInterval = null;
let sendMinecraftToDiscord = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function walkForwardBackward() {
  if (!bot || !bot.entity) return;
  bot.setControlState('forward', true);
  await sleep(15000);
  bot.setControlState('forward', false);
  bot.setControlState('back', true);
  await sleep(15000);
  bot.setControlState('back', false);
}

function logMsg(msg, type = 'system') {
  console.log(msg);
  io.emit('log', { message: msg, type });
  
  // Update status in the web interface
  const isOnline = bot !== null;
  io.emit('status', {
    text: isOnline ? 'Online' : 'Offline',
    online: isOnline
  });
}

function createBot() {
  bot = mineflayer.createBot({
    host: 'TokyoServer.aternos.me',
    port: 43234,
    username: 'TOKyodot',
    connectTimeout: 60000,
    keepAlive: true,
  });

  bot.once('login', () => {
    logMsg(`✅ Logged in as ${bot.username}`);

    if (!autoMessageInterval) {
      autoMessageInterval = setInterval(() => {
        if (bot && bot.chat) {
          bot.chat('Welcome to Tokyo dz server — join our Discord: https://discord.gg/E4XpZeywAJ');
          logMsg('📢 Auto-message sent.');
        }
      }, 15 * 60 * 1000);
    }

    if (!autoMoveInterval) {
      autoMoveInterval = setInterval(() => {
        walkForwardBackward();
      }, 30000);
    }
  });

  bot.on('end', () => {
    logMsg('⚠️ Bot disconnected, reconnecting...', 'error');

    if (autoMessageInterval) {
      clearInterval(autoMessageInterval);
      autoMessageInterval = null;
    }
    if (autoMoveInterval) {
      clearInterval(autoMoveInterval);
      autoMoveInterval = null;
    }

    setTimeout(createBot, 5000);
  });

  bot.on('error', (err) => logMsg(`❌ Error: ${err}`, 'error'));

  bot.on('chat', (username, message) => {
    logMsg(`<${username}> ${message}`, 'chat');

    if (message.startsWith('!ask ')) {
      const question = message.slice(5).trim();
      if (!question) return bot.chat("Please provide a question.");
      bot.chat("💭 Thinking...");
      askAI(question).then(answer => {
        bot.chat(`🤖 ${answer}`);
      });
    }

    if (sendMinecraftToDiscord && discordClient.isReady()) {
      const channel = discordClient.channels.cache.get(discordChannelId);
      if (channel) {
        channel.send(`**[Minecraft]** <${username}> ${message}`);
      }
    }
  });
}

io.on('connection', (socket) => {
  logMsg('🌐 Web client connected');
  
  // Send initial status
  socket.emit('status', {
    text: bot ? 'Online' : 'Offline',
    online: bot !== null
  });

  socket.on('sendMessage', (msg) => {
    if (bot && bot.chat) {
      bot.chat(msg);
      logMsg(`💬 [WEB] ${msg}`, 'chat');
    }
  });

  socket.on('control', (action) => {
    switch (action) {
      case 'start':
        if (!bot) {
          createBot();
          logMsg('🔄 Bot started by web interface');
        }
        break;
      case 'stop':
        if (bot) {
          bot.quit('Stopped via web interface');
          bot = null;
          if (autoMessageInterval) clearInterval(autoMessageInterval);
          if (autoMoveInterval) clearInterval(autoMoveInterval);
          logMsg('🛑 Bot stopped by web interface');
        }
        break;
      case 'restart':
        if (bot) {
          bot.quit('Restarting via web interface');
          bot = null;
          if (autoMessageInterval) clearInterval(autoMessageInterval);
          if (autoMoveInterval) clearInterval(autoMoveInterval);
          setTimeout(createBot, 3000);
          logMsg('🔄 Bot restarting...');
        }
        break;
    }
  });

  socket.on('getStatus', () => {
    socket.emit('status', {
      text: bot ? 'Online' : 'Offline',
      online: bot !== null
    });
  });
});

// Website check every 5 minutes
let lastWebsiteStatus = 'Unknown';
async function checkWebsite() {
  try {
    await axios.get('https://lol-33.onrender.com/');
    lastWebsiteStatus = '✅ Online';
  } catch (err) {
    lastWebsiteStatus = '❌ Offline';
  }
}
setInterval(checkWebsite, 5 * 60 * 1000);
checkWebsite();

discordClient.on('ready', () => {
  console.log(`Discord Bot logged in as ${discordClient.user.tag}`);
});

discordClient.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== discordChannelId) return;

  const content = message.content.trim();

  if (content === '/start') {
    if (bot) {
      message.channel.send('Minecraft bot is already running.');
    } else {
      createBot();
      message.channel.send('Minecraft bot started.');
    }
  } else if (content === '/stop') {
    if (bot) {
      bot.quit('Stopped via Discord.');
      bot = null;
      if (autoMessageInterval) clearInterval(autoMessageInterval);
      if (autoMoveInterval) clearInterval(autoMoveInterval);
      message.channel.send('Minecraft bot stopped.');
    } else {
      message.channel.send('Minecraft bot is not running.');
    }
  } else if (content === '/rs') {
    if (bot) {
      bot.quit('Restarting...');
      bot = null;
      if (autoMessageInterval) clearInterval(autoMessageInterval);
      if (autoMoveInterval) clearInterval(autoMoveInterval);
      setTimeout(() => {
        createBot();
        message.channel.send('Minecraft bot restarted.');
      }, 3000);
    } else {
      message.channel.send('Minecraft bot is not running.');
    }
  } else if (content === '/pn') {
    sendMinecraftToDiscord = !sendMinecraftToDiscord;
    message.channel.send(sendMinecraftToDiscord ? '📩 Minecraft messages will be sent here.' : '🚫 Minecraft messages disabled.');
  } else if (content === '/ping') {
    message.channel.send(`📊 **System Status**:
- Discord Bot: ${discordClient.isReady() ? '✅ Online' : '❌ Offline'}
- Minecraft Bot: ${bot ? '✅ Connected' : '❌ Disconnected'}
- Website: ${lastWebsiteStatus}`);
  } else if (content.startsWith('/ask ')) {
    const question = content.slice(5).trim();
    if (!question) return message.reply("Please provide a question.");
    message.channel.send("💭 Thinking...");
    const answer = await askAI(question);
    message.channel.send(`🤖 ${answer}`);
  } else {
    if (bot && bot.chat) {
      bot.chat(content);
      message.react('✅');
    }
  }
});

discordClient.login(discordToken);

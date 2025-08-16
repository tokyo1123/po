import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("error", (err) => console.error("❌ Discord Error:", err));

const token = process.env.DISCORD_TOKEN;
console.log("DISCORD TOKEN LENGTH:", token?.length);

client.login(token);

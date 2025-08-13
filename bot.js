import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  Routes
} from 'discord.js';
import { REST } from '@discordjs/rest';

const DEFAULTS = {
  width: 768,
  height: 768,
  model: 'flux',
  seed: 0,
  nologo: true,
  enhance: false
};

function buildImageUrl(prompt, opts = {}) {
  const w = Number.isFinite(+opts.width) ? +opts.width : DEFAULTS.width;
  const h = Number.isFinite(+opts.height) ? +opts.height : DEFAULTS.height;
  const mdl = opts.model || DEFAULTS.model;
  const sd = Number.isFinite(+opts.seed) ? +opts.seed : DEFAULTS.seed;
  const nlg = (opts.nologo ?? DEFAULTS.nologo) ? 'true' : 'false';
  const enh = (opts.enhance ?? DEFAULTS.enhance) ? 'true' : 'false';

  const q = new URLSearchParams({
    width: String(w),
    height: String(h),
    model: mdl,
    seed: String(sd),
    nologo: nlg,
    enhance: enh
  });

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q.toString()}`;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder()
    .setName('gn')
    .setDescription('Generate an image using Pollinations')
    .addStringOption(opt =>
      opt.setName('prompt').setDescription('Image description').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('width').setDescription('Image width (px)')
    )
    .addIntegerOption(opt =>
      opt.setName('height').setDescription('Image height (px)')
    )
    .addStringOption(opt =>
      opt.setName('model').setDescription('Model name')
    )
    .addIntegerOption(opt =>
      opt.setName('seed').setDescription('Random seed number')
    )
    .addBooleanOption(opt =>
      opt.setName('nologo').setDescription('Remove logo')
    )
    .addBooleanOption(opt =>
      opt.setName('enhance').setDescription('Enhance image')
    )
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
  } catch (err) {
    console.error(err);
  }
})();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'gn') return;

  const prompt = interaction.options.getString('prompt');
  const options = {
    width: interaction.options.getInteger('width') ?? DEFAULTS.width,
    height: interaction.options.getInteger('height') ?? DEFAULTS.height,
    model: interaction.options.getString('model') ?? DEFAULTS.model,
    seed: interaction.options.getInteger('seed') ?? DEFAULTS.seed,
    nologo: interaction.options.getBoolean('nologo') ?? DEFAULTS.nologo,
    enhance: interaction.options.getBoolean('enhance') ?? DEFAULTS.enhance
  };

  await interaction.deferReply();
  try {
    const url = buildImageUrl(prompt, options);
    await interaction.editReply(`**Prompt:** ${prompt}\n${url}`);
  } catch (err) {
    console.error(err);
    await interaction.editReply('Error generating image.');
  }
});

client.login(process.env.DISCORD_TOKEN);

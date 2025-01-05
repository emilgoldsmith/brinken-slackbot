import { DateTime } from "luxon";
import {
  handleWeekBeforeBirthday,
  handleDayBeforeBirthday,
  birthdayActionListeners,
} from "./libs/birthday.js";
import {
  dinnerActionListeners,
  handleDayOfDinner,
  handleThreeDaysBeforeDinner,
} from "./libs/dinner.js";
import {
  clearOutdatedInteractionsInCache,
  DISCORD_TEST_CHANNEL_ID,
  globalActionListeners,
  sendMessageToChannel,
  setDiscordClient,
} from "./libs/globals.js";
import { slashCommands } from "./libs/slash-commands.js";
import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import { stringifyDiscordClass } from "./libs/utils.js";
import express from "express";
import { handleTwoDaysBeforeHouseMeeting } from "./libs/general.js";

const expApp = express();

expApp.get("/keep-alive", (req, res) => {
  res.writeHead(200);
  res.end();
  clearOutdatedInteractionsInCache();
});

expApp.get("/handle-day", (req, res) => {
  handleDay().catch((e) => {
    const errorMessage = e instanceof Error ? e.stack : JSON.stringify(e);
    sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message: `Error occurred during handle day: ${errorMessage}`,
    }).catch(console.error);
  });
  res.writeHead(200);
  res.end();
});

const expressPort = process.env.PORT ?? 3000;
expApp.listen(expressPort, () => {
  console.log(`Express server listening on port ${expressPort}`);
});

async function handleDay() {
  const inAWeek = DateTime.now().plus({ weeks: 1 }).toFormat("MM-dd");
  console.log(inAWeek);
  await handleWeekBeforeBirthday(inAWeek);
  const inADay = DateTime.now().plus({ days: 1 }).toFormat("MM-dd");
  console.log(inADay);
  await handleDayBeforeBirthday(inADay);
  const inTwoDays = DateTime.now().plus({ days: 2 });
  console.log(inTwoDays);
  await handleTwoDaysBeforeHouseMeeting(inTwoDays);
  const inThreeDays = DateTime.now().plus({ days: 3 });
  console.log(inThreeDays);
  await handleThreeDaysBeforeDinner(inThreeDays);
  const today = DateTime.now();
  console.log(today);
  await handleDayOfDinner(today);
}

async function handleSlashCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    await sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message: `Command not found: ${interaction.commandName}`,
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.stack : JSON.stringify(e);
    await sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message: `Error occurred during command execution: ${errorMessage}, and the command interaction was: ${stringifyDiscordClass(
        interaction
      )}`,
    });
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
}

async function handleButtonInteraction(interaction) {
  const [actionId, actionValue] = interaction.customId.split("*");

  const handler = globalActionListeners
    .concat(dinnerActionListeners)
    .concat(birthdayActionListeners)
    .find(([id]) => id === actionId)?.[1];

  if (handler === undefined) {
    await interaction.reply({
      content: "Unkown button interaction received",
      ephemeral: true,
    });
    await sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message: `Unknown button interaction received: ${stringifyDiscordClass(
        interaction
      )}`,
    });
    return;
  }

  try {
    await handler({ interaction, actionValue });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.stack : JSON.stringify(e);
    await sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message: `Error occurred during button interaction: ${errorMessage}, and the interaction was: ${stringifyDiscordClass(
        interaction
      )}`,
    });
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this button interaction!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this button interaction!",
        ephemeral: true,
      });
    }
  }
}

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

discordClient.commands = new Collection();

slashCommands.forEach((command) => {
  discordClient.commands.set(command.data.name, command);
});

discordClient.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
  else if (interaction.isButton()) await handleButtonInteraction(interaction);
  else {
    sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message: `Unknown interaction received: ${JSON.stringify(interaction)}`,
    });
  }
});

await new Promise((resolve) => {
  discordClient.once(Events.ClientReady, async (readyClient) => {
    resolve(readyClient);
  });
  discordClient.login(process.env.DISCORD_BOT_TOKEN);
});

if (!discordClient.isReady()) {
  throw new Error("discord client wasn't ready when expected to be");
}
setDiscordClient(discordClient);

console.log("Discord App Initialized And Running");
// const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
// guild.members
//   .fetch()
//   .then((x) => x.forEach((y) => console.log(y.user)))
//   .then(() => discordClient.destroy())
//   .then(() => process.exit(0));
// const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
// await guild.emojis
//   .fetch()
//   .then(console.log)
//   .then(() => discordClient.destroy())
//   .then(() => process.exit(0));
// const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
// await guild.channels
//   .fetch()
//   .then(console.log)
//   .then(() => discordClient.destroy())
//   .then(() => process.exit(0));

// await handleThreeDaysBeforeDinner(
//   DateTime.now().set({ weekday: 4 }).plus({ week: 1 })
// );
// await new Promise((resolve) => setTimeout(resolve, 5000));
// await handleDayOfDinner(DateTime.now().set({ weekday: 4 }).plus({ week: 1 }));

// await discordClient.destroy();
// process.exit(0);

import "./index.js";
import { DISCORD_GUILD_ID, discordClient } from "./libs/globals.js";

const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
await guild.emojis
  .fetch()
  .then(console.log)
  .then(() => discordClient.destroy())
  .then(() => process.exit(0));

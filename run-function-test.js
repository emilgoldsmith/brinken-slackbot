import "./index.js";
import { DISCORD_GUILD_ID, discordClient } from "./libs/globals.js";

const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
guild.members
  .fetch()
  .then((x) => x.forEach((y) => console.log(y.user)))
  .then(() => discordClient.destroy())
  .then(() => process.exit(0));

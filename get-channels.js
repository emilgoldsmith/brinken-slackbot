import "./index.js";
import { DISCORD_GUILD_ID, discordClient } from "./libs/globals.js";

const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
await guild.channels
  .fetch()
  .then((x) => x.map((y) => ({ id: y.id, name: y.name })))
  .then(console.log)
  .then(() => discordClient.destroy())
  .then(() => process.exit(0));

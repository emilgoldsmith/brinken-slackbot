import "./index.js";
import { discordClient } from "./libs/globals.js";

// Call a function that you want to test here

await discordClient.destroy();
process.exit(0);

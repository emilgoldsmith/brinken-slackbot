import { DateTime } from "luxon";
import "./index.js";
import { handleDayOfDinner } from "./libs/dinner.js";
import { discordClient } from "./libs/globals.js";

await handleDayOfDinner(DateTime.now().set({ weekday: 3 }));

await discordClient.destroy();
process.exit(0);

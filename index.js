import slackBolt from "@slack/bolt";
import { DateTime } from "luxon";
import { brinkenbotTestSlashCommand } from "./libs/test-slash-command.js";
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
import { globalActionListeners } from "./libs/globals.js";

const slackApp = new slackBolt.App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  customRoutes: [
    {
      path: "/keep-alive",
      method: ["GET"],
      handler: (req, res) => {
        res.writeHead(200);
        res.end();
      },
    },
    {
      path: "/handle-day",
      method: ["GET"],
      handler: (req, res) => {
        handleDay().catch((e) => {
          const errorMessage = e instanceof Error ? e.stack : JSON.stringify(e);
          slackClient.chat
            .postMessage({
              channel: SLACKBOT_TEST_CHANNEL,
              text: `Error occurred during handle day: ${errorMessage}`,
            })
            .catch(console.error);
        });
        res.writeHead(200);
        res.end();
      },
    },
  ],
});

slackApp.command("/brinkenbot-test", brinkenbotTestSlashCommand());

globalActionListeners
  .concat(dinnerActionListeners)
  .concat(birthdayActionListeners)
  .forEach(([actionId, listener]) => slackApp.action(actionId, listener));

(async () => {
  const port = process.env.PORT || 3000;
  // Start your app
  await slackApp.start(port);

  console.log("⚡️ Bolt app is running on port " + port + "!");
})();

async function handleDay() {
  const inAWeek = DateTime.now().plus({ weeks: 1 }).toFormat("MM-dd");
  console.log(inAWeek);
  await handleWeekBeforeBirthday(inAWeek);
  const inADay = DateTime.now().plus({ days: 1 }).toFormat("MM-dd");
  console.log(inADay);
  await handleDayBeforeBirthday(inADay);
  const inThreeDays = DateTime.now().plus({ days: 3 });
  console.log(inThreeDays);
  await handleThreeDaysBeforeDinner(inThreeDays);
  const today = DateTime.now();
  console.log(today);
  await handleDayOfDinner(today);
}

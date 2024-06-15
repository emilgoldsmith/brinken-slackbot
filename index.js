const { App } = require("@slack/bolt");
const sheetdb = require("sheetdb-node");
const _ = require("lodash");
const { DateTime } = require("luxon");

// Initializes your app with your bot token and signing secret
const slackApp = new App({
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
  ],
});

const sheetDbClient = sheetdb({
  address: "jp1hjy317fz23",
  auth_login: process.env.SHEET_DB_LOGIN,
  auth_password: process.env.SHEET_DB_PASSWORD,
});

BEBOERE_SHEET_NAME = "Beboere";

(async () => {
  const port = process.env.PORT || 3000;
  // Start your app
  await slackApp.start(port);

  console.log("⚡️ Bolt app is running on port " + port + "!");

  await handleBirthday();
})();

async function handleBirthday(targetBirthday) {
  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );

  const withSortableBirthdays = members
    .filter((x) => x.fødselsdag)
    .map((x) => {
      const birthdayDate = DateTime.fromISO(x.fødselsdag);
      return {
        ...x,
        sortableBirthday: birthdayDate.toFormat("MM-dd"),
      };
    });

  console.log(withSortableBirthdays);

  // slackApp.client.channels.create({name: })
}

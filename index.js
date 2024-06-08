const { App } = require("@slack/bolt");
const sheetdb = require("sheetdb-node");

// Initializes your app with your bot token and signing secret
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const sheetDbClient = sheetdb({
  address: "jp1hjy317fz23",
  auth_login: process.env.SHEET_DB_LOGIN,
  auth_password: process.env.SHEET_DB_PASSWORD,
});

SHEET_NAME = "Sheet1";

(async () => {
  const port = process.env.PORT || 3000;
  // Start your app
  await slackApp.start(port);

  console.log("⚡️ Bolt app is running on port " + port + "!");

  await slackApp.client.chat.postMessage({
    channel: "slackbot-test",
    text: "testing 1, 2, 3",
  });

  const response = await sheetDbClient.create([
    { id: "INCREMENT", name: "test", time: "TIMESTAMP" },
  ]);
  console.log(response);
})();

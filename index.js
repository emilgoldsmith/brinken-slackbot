const { App } = require("@slack/bolt");
const sheetdb = require("sheetdb-node");
const _ = require("lodash");
const { DateTime } = require("luxon");
const crypto = require("crypto");

const sheetDbClient = sheetdb({
  address: "jp1hjy317fz23",
  auth_login: process.env.SHEET_DB_LOGIN,
  auth_password: process.env.SHEET_DB_PASSWORD,
});

const BEBOERE_SHEET_NAME = "Beboere";
const SLACKBOT_TEST_CHANNEL = "slackbot-test";

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
    {
      path: "/handle-day",
      method: ["GET"],
      handler: (req, res) => {
        handleDay().catch((e) => {
          const errorMessage = e instanceof Error ? e.stack : JSON.stringify(e);
          slackApp.client.chat
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

(async () => {
  const port = process.env.PORT || 3000;
  // Start your app
  await slackApp.start(port);

  console.log("⚡️ Bolt app is running on port " + port + "!");
})();

async function handleDay() {
  await slackApp.client.chat.postMessage({
    channel: SLACKBOT_TEST_CHANNEL,
    text: "Starting handle day",
  });

  await handleWeekBeforeBirthday(
    DateTime.now().plus({ weeks: 1 }).toFormat("MM-dd")
  );
  await handleDayBeforeBirthday(
    DateTime.now().plus({ days: 1 }).toFormat("MM-dd")
  );

  await slackApp.client.chat.postMessage({
    channel: SLACKBOT_TEST_CHANNEL,
    text: "Completed handle day successfully",
  });
}

async function handleWeekBeforeBirthday(
  targetBirthdayMMDD,
  channelNameSuffix = ""
) {
  const { birthdayPeople, sortedBirthdays, members } = await getBirthdayPeople(
    targetBirthdayMMDD
  );

  if (birthdayPeople.length <= 0) return;

  let lowestBirthdayIndex = sortedBirthdays.findIndex(
    (x) => x.sortableBirthday === targetBirthdayMMDD
  );
  if (lowestBirthdayIndex === -1) {
    await slackApp.client.chat.postMessage({
      channel: SLACKBOT_TEST_CHANNEL,
      text: "'Impossible' error occurred, couldn't find birthday person after finding birthday people",
    });
    return;
  }

  let firstResponsibleIndex = lowestBirthdayIndex - 1;
  if (firstResponsibleIndex === -1) {
    firstResponsibleIndex = sortedBirthdays.length - 1;
  }

  const responsiblePeople = sortedBirthdays.filter(
    (x) =>
      x.sortableBirthday ===
      sortedBirthdays[firstResponsibleIndex].sortableBirthday
  );

  if (responsiblePeople.length <= 0) {
    await slackApp.client.chat.postMessage({
      channel: SLACKBOT_TEST_CHANNEL,
      text: `Couldn't find any responsible people for the birthday. Sorted birthdays: ${JSON.stringify(
        sortedBirthdays
      )}`,
    });
    return;
  }

  const birthdayCelebrators = members.filter(
    (m) => !birthdayPeople.map((p) => p.id).includes(m.id)
  );

  let birthdayYear = DateTime.now().year;
  if (
    DateTime.fromISO(`${birthdayYear}-${targetBirthdayMMDD}`) < DateTime.now()
  ) {
    birthdayYear += 1;
  }

  const birthdayChannelName = buildBirthdayChannelName(
    birthdayPeople,
    channelNameSuffix
  );

  const { channel: birthdayChannel } =
    await slackApp.client.conversations.create({
      name: birthdayChannelName,
      is_private: true,
    });

  await slackApp.client.conversations.invite({
    channel: birthdayChannel?.id,
    users: birthdayCelebrators.map((x) => x["slack-id"]).join(","),
  });

  await slackApp.client.chat.postMessage({
    channel: birthdayChannelName,
    text: `Så blev det fødselsdagstid igen! Denne gang har vi:\n\n${birthdayPeople
      .map(
        (x) =>
          `<@${x["slack-id"]}> der bliver ${
            birthdayYear - DateTime.fromISO(x.fødselsdag).year
          } år gammel`
      )
      .join("\n")}\n\nDe har fødselsdag om en uge d. ${
      DateTime.fromISO(birthdayPeople[0].fødselsdag).day
    }. ${
      DateTime.fromISO(birthdayPeople[0].fødselsdag).setLocale("da-DK")
        .monthLong
    }, og det er ${naturalLanguageList(
      responsiblePeople.map((x) => `<@${x["slack-id"]}>`)
    )} der er hovedansvarlig(e) for fødselsdags morgenmad`,
  });
}

async function handleDayBeforeBirthday(
  targetBirthdayMMDD,
  channelNameSuffix = ""
) {
  const { birthdayPeople } = getBirthdayPeople(targetBirthdayMMDD);
  if (birthdayPeople.length <= 0) return;

  const birthdayChannelName = buildBirthdayChannelName(
    birthdayPeople,
    channelNameSuffix
  );

  await slackApp.client.chat.postMessage({
    channel: birthdayChannelName,
    text: "Så er det i morgen der er fødselsdag <!channel>! ",
  });
}

async function getBirthdayPeople(targetBirthdayMMDD) {
  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );

  const sortedBirthdays = _.chain(members)
    .filter((x) => x.fødselsdag)
    .map((x) => {
      const birthdayDate = DateTime.fromISO(x.fødselsdag);
      return {
        ...x,
        sortableBirthday: birthdayDate.toFormat("MM-dd"),
      };
    })
    .sortBy(["sortableBirthday"])
    .value();

  const birthdayPeople = sortedBirthdays.filter(
    (x) => targetBirthdayMMDD === x.sortableBirthday
  );
  return { birthdayPeople, sortedBirthdays, members };
}

function buildBirthdayChannelName(birthdayPeople, channelNameSuffix) {
  return (
    birthdayPeople.map((x) => x.navn.toLowerCase()).join("-") +
    `-fødselsdag-${birthdayYear}` +
    (channelNameSuffix ? "-" + channelNameSuffix : "")
  );
}

function naturalLanguageList(items) {
  if (items.length <= 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  return (
    items.slice(0, items.length - 1).join(", ") +
    ` og ${items[items.length - 1]}`
  );
}

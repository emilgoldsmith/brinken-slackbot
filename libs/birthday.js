import _ from "lodash";
import { DateTime } from "luxon";
import { stringNaturalLanguageList } from "./utils.js";
import {
  slackClient,
  SLACKBOT_TEST_CHANNEL,
  sheetDbClient,
  BEBOERE_SHEET_NAME,
} from "./globals.js";

export async function handleWeekBeforeBirthday(
  targetBirthdayMMDD,
  channelNameSuffix = ""
) {
  const { birthdayPeople, sortedBirthdays, members, birthdayYear } =
    await getBirthdayPeople(targetBirthdayMMDD);

  if (birthdayPeople.length <= 0) return;

  let lowestBirthdayIndex = sortedBirthdays.findIndex(
    (x) => x.sortableBirthday === targetBirthdayMMDD
  );
  if (lowestBirthdayIndex === -1) {
    await slackClient.chat.postMessage({
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
    await slackClient.chat.postMessage({
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

  const birthdayChannelName = buildBirthdayChannelName(
    birthdayPeople,
    birthdayYear,
    channelNameSuffix
  );

  const { channel: birthdayChannel } = await slackClient.conversations.create({
    name: birthdayChannelName,
    is_private: true,
  });

  await slackClient.conversations.invite({
    channel: birthdayChannel?.id,
    users: birthdayCelebrators.map((x) => x["slack-id"]).join(","),
  });

  await slackClient.chat.postMessage({
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
    }, og det er ${stringNaturalLanguageList(
      responsiblePeople.map((x) => `<@${x["slack-id"]}>`)
    )} der er hovedansvarlig(e) for fødselsdags morgenmad`,
  });
}
export async function handleDayBeforeBirthday(
  targetBirthdayMMDD,
  channelNameOverride = null
) {
  let birthdayChannelName;
  if (channelNameOverride !== null) {
    birthdayChannelName = channelNameOverride;
  } else {
    const { birthdayPeople, birthdayYear } = await getBirthdayPeople(
      targetBirthdayMMDD
    );
    if (birthdayPeople.length <= 0) return;

    birthdayChannelName = buildBirthdayChannelName(
      birthdayPeople,
      birthdayYear
    );
  }

  await slackClient.chat.postMessage({
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

  let birthdayYear = DateTime.now().year;
  if (
    DateTime.fromISO(`${birthdayYear}-${targetBirthdayMMDD}`) < DateTime.now()
  ) {
    birthdayYear += 1;
  }

  return { birthdayPeople, sortedBirthdays, members, birthdayYear };
}
function buildBirthdayChannelName(
  birthdayPeople,
  birthdayYear,
  channelNameSuffix
) {
  return (
    birthdayPeople.map((x) => x.navn.toLowerCase()).join("-") +
    `-fødselsdag-${birthdayYear}` +
    (channelNameSuffix ? "-" + channelNameSuffix : "")
  );
}

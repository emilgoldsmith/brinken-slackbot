import _ from "lodash";
import slackBolt from "@slack/bolt";
import { DateTime } from "luxon";
import { stringNaturalLanguageList } from "./utils.js";
import {
  slackClient,
  SLACKBOT_TEST_CHANNEL,
  sheetDbClient,
  BEBOERE_SHEET_NAME,
  deleteMessageActionId,
} from "./globals.js";

export const birthdayButtons = [
  {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Se alle fødselsdage",
        },
        action_id: "see-birthday-schedule",
      },
    ],
  },
];

/**
 * @param {object} obj
 * @param {string} obj.text
 * @param {(slackBolt.Block | slackBolt.KnownBlock)[]} obj.blocks
 * @param {string} obj.channel
 */
function sendBirthdayMessage({ text, blocks, channel }) {
  return slackClient.chat.postMessage({
    channel,
    text,
    blocks: [...blocks, birthdayButtons],
  });
}

/**
 * @type {[string, slackBolt.Middleware<slackBolt.SlackActionMiddlewareArgs<slackBolt.SlackAction>][]}
 */
export const birthdayActionListeners = [
  [
    "see-birthday-schedule",
    async ({ ack, respond }) => {
      await ack();

      const members = JSON.parse(
        await sheetDbClient.read({
          sheet: BEBOERE_SHEET_NAME,
        })
      );

      const { sortedBirthdays: sortedRelativeTo1Jan } = await getBirthdayPeople(
        ""
      );
      const [sortedBirthdaysThisYear, sortedBirthdaysNextYear] = _.chain(
        sortedRelativeTo1Jan
      )
        .partition((x) => x.birthdayYear === DateTime.now().year)
        .value();

      const sortedBirthdays = [
        ...sortedBirthdaysThisYear,
        ...sortedBirthdaysNextYear,
      ];

      await respond({
        replace_original: false,
        response_type: "ephemeral",
        text: sortedBirthdays
          .map((x) => `<@${x["slack-id"]}>: ${x.nextAge} år`)
          .join(", "),
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Næste Års Fødselsdage",
            },
          },
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_list",
                style: "bullet",
                elements: sortedBirthdays.map((x) => ({
                  type: "rich_text_section",
                  elements: [
                    {
                      type: "text",
                      text: `${DateTime.fromISO(x.fødselsdag)
                        .setLocale("da-DK")
                        .toFormat("dd. MMMM")}: `,
                      style: {
                        bold: true,
                      },
                    },
                    {
                      type: "emoji",
                      name: "flag-dk",
                    },
                    {
                      type: "user",
                      user_id: x["slack-id"],
                    },
                    {
                      type: "text",
                      text: ` bliver ${x.nextAge} år `,
                    },
                    {
                      type: "emoji",
                      name: "flag-dk",
                    },
                  ],
                })),
              },
            ],
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Skjul besked",
                },
                style: "danger",
                action_id: deleteMessageActionId,
              },
            ],
          },
        ],
      });
    },
  ],
];

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

  // const birthdayChannelName = buildBirthdayChannelName(
  //   birthdayPeople,
  //   birthdayYear,
  //   channelNameSuffix
  // );

  // const { channel: birthdayChannel } = await slackClient.conversations.create({
  //   name: birthdayChannelName,
  //   is_private: true,
  // });

  // await slackClient.conversations.invite({
  //   channel: birthdayChannel?.id,
  //   users: birthdayCelebrators.map((x) => x["slack-id"]).join(","),
  // });
  const birthdayChannelName = SLACKBOT_TEST_CHANNEL;

  await slackClient.chat.postMessage({
    channel: birthdayChannelName,
    text: `Så blev det fødselsdagstid igen! Denne gang har vi:\n\n${birthdayPeople
      .map((x) => `<@${x["slack-id"]}> der bliver ${x.nextAge} år gammel`)
      .join("\n")}\n\nDe har fødselsdag om en uge ${DateTime.fromISO(
      x.fødselsdag
    )
      .setLocale("da-DK")
      .toFormat("EEEE 'd.' dd. MMMM")}, og det er ${stringNaturalLanguageList(
      responsiblePeople.map((x) => `<@${x["slack-id"]}>`)
    )} der er hovedansvarlig(e) for fødselsdags morgenmad`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":flag-dk::flag-dk::flag-dk:Der er fødselsdag i kollektivet!:flag-dk::flag-dk::flag-dk:",
          emoji: true,
        },
      },
      {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text: "Så blev det fødselsdagstid igen! Denne gang har vi:\n\n",
              },
            ],
          },
          {
            type: "rich_text_list",
            style: "bullet",
            elements: sortedBirthdays.map((x) => ({
              type: "rich_text_section",
              elements: [
                {
                  type: "emoji",
                  name: "flag-dk",
                },
                {
                  type: "user",
                  user_id: x["slack-id"],
                },
                {
                  type: "text",
                  text: ` der bliver ${x.nextAge} år `,
                },
                {
                  type: "emoji",
                  name: "flag-dk",
                },
              ],
            })),
          },
        ],
      },
      ...birthdayButtons,
    ],
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

  await sendBirthdayMessage({
    channel: birthdayChannelName,
    text: "Så er det i morgen der er fødselsdag <!channel>! ",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Fødselsdag i morgen!",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "<!channel>",
        },
      },
      ...birthdayButtons,
    ],
  });
}

async function getBirthdayPeople(targetBirthdayMMDD) {
  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );

  const sortedBirthdays = _.chain(members)
    .map((x) => {
      const birthdayDate = DateTime.fromISO(x.fødselsdag);
      const birthdayYear =
        birthdayDate.set({ year: DateTime.now().year }) < DateTime.now()
          ? DateTime.now().year + 1
          : DateTime.now().year;
      return {
        ...x,
        sortableBirthday: birthdayDate.toFormat("MM-dd"),
        birthdayYear: birthdayYear,
        nextAge: birthdayYear - birthdayDate.year,
      };
    })
    .sortBy(["sortableBirthday"])
    .value();

  const birthdayPeople = sortedBirthdays.filter(
    (x) => targetBirthdayMMDD === x.sortableBirthday
  );

  return {
    birthdayPeople,
    sortedBirthdays,
    members,
    birthdayYear: birthdayPeople[0]?.birthdayYear,
  };
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

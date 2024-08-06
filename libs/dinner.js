import slackBolt from "@slack/bolt";
import { richTextNaturalLanguageList } from "./utils.js";
import {
  sheetDbClient,
  BEBOERE_SHEET_NAME,
  TORSDAGS_TALLERKEN_SHEET_NAME,
  TORSDAGS_TALLERKEN_CHANNEL,
  slackClient,
  THIS_BOT_USER_ID,
  deleteMessageActionId,
  justAcknowledgeResponseActionId,
} from "./globals.js";
import { DateTime } from "luxon";
import lodashJoins from "lodash-joins";

const dinnerButtons = {
  type: "actions",
  elements: [
    {
      type: "button",
      text: {
        type: "plain_text",
        text: "Se skema",
      },
      action_id: "see-dinner-schedule",
    },
    {
      type: "button",
      text: {
        type: "plain_text",
        text: "Ret skema",
      },
      action_id: "edit-dinner-schedule",
    },
  ],
};

/**
 * @param {object} obj
 * @param {string} obj.text
 * @param {(slackBolt.Block | slackBolt.KnownBlock)[]} obj.blocks
 * @param {string} obj.channel
 */
function sendDinnerMessage({ text, blocks, channel }) {
  return slackClient.chat.postMessage({
    channel,
    text,
    blocks: [...blocks, dinnerButtons],
  });
}

/**
 * @type {[string, slackBolt.Middleware<slackBolt.SlackActionMiddlewareArgs<slackBolt.SlackAction>][]}
 */
export const dinnerActionListeners = [
  [
    "see-dinner-schedule",
    async ({ ack, respond }) => {
      await ack();
      await handlerDinnerScheduleActionResponse({
        respond,
        startDate: DateTime.now(),
        endDate: DateTime.now().plus({ weeks: 4 }),
        updateOriginal: false,
      });
    },
  ],
  [
    "show-more-dinner-schedule",
    async ({ ack, respond, action }) => {
      await ack();
      await handlerDinnerScheduleActionResponse({
        respond,
        startDate: DateTime.now(),
        endDate: DateTime.fromISO(action.value).plus({ weeks: 4 }),
        updateOriginal: true,
      });
    },
  ],
  [
    "edit-dinner-schedule",
    async ({ ack, respond }) => {
      await ack();
      const mainText =
        'Det kan godt være det følgende virker lidt skræmmende for en ikke teknisk person, men jeg ved du godt kan klare det, og bare rolig hvis noget går galt så fikser vi det bare igen, ingen fare overhovedet :heart:.\n\nFor at beholde så meget fleksibilitet som muligt har vi valgt at den bedste måde, trods lidt kompleksitet, er at rette direkte i vores "database." Vi har dog heldigvis bare brugt Google Sheets som vores database for at forhåbentligt gøre det så nemt som muligt at rette i. Tryk på knappen nedenfor for at gå til regnearket, hvor du først vil se den mere menneskelæselige version hvor du kan få overblik over hvordan du vil rette. Når du så rent faktisk skal rette går du over til "Torsdagstallerken" arket, dette er også tydeligt markeret i regnearket, og her kan du så lave de rent faktiske database rettelser. Computere er dumme så det er vigtigt her at du følger formatet med at bruge tal til at referere til os beboere og at datoerne er i År-Måned-Dato format, men som vi skrev ovenfor, bare stol på dig selv, det skal nok gå, og hvis noget går galt så fikser de mere tekniske personer i kollektivet det bare. Der er intet der er i fare for at blive fuldstændig ødelagt, vi kan altid finde tilbage til den tilstand den var i før.';
      const url =
        "https://docs.google.com/spreadsheets/d/12BjvaehXZyt2CI_rqfexB6pXbZcACS4x3iKM7xMaMOI/edit?usp=sharing&gid=451251755";
      await respond({
        replace_original: false,
        response_type: "ephemeral",
        text: `${mainText}.\n\nHer er linket: ${url}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Sådan retter man i programmet:",
            },
          },
          {
            type: "section",
            text: {
              type: "plain_text",
              emoji: true,
              text: mainText,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Gå til regneark",
                },
                style: "primary",
                url,
                action_id: justAcknowledgeResponseActionId,
              },
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

/**
 * @param {object} obj
 * @param {slackBolt.respondFn} obj.respond
 * @param {DateTime} obj.startDate
 * @param {DateTime} obj.endDate
 * @param {boolean} obj.updateOriginal
 */
async function handlerDinnerScheduleActionResponse({
  respond,
  startDate,
  endDate,
  updateOriginal,
}) {
  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );

  const allDbRows = JSON.parse(
    await sheetDbClient.read({
      sheet: TORSDAGS_TALLERKEN_SHEET_NAME,
      sort_by: "dato",
      sort_order: "asc",
      sort_method: "date",
      sort_date_format: "Y-m-d",
    })
  );

  const targetDbRows = allDbRows.filter(
    (x) =>
      x.dato >= startDate.toFormat("yyyy-MM-dd") &&
      x.dato <= endDate.toFormat("yyyy-MM-dd")
  );

  const hasMore =
    allDbRows.find((x) => x.dato > endDate.toFormat("yyyy-MM-dd")) !==
    undefined;

  const headChefJoined = lodashJoins.hashInnerJoin(
    members,
    (x) => x.id,
    targetDbRows,
    (x) => x.hovedkok
  );
  const formattedObjects = lodashJoins.hashInnerJoin(
    members,
    (x) => x.id,
    headChefJoined,
    (x) => x.kokkeassistent,
    (memb, headChef) => ({
      headChef: headChef["slack-id"],
      assistent: memb["slack-id"],
      date: DateTime.fromISO(headChef.dato)
        .setLocale("da-dk")
        .toLocaleString(DateTime.DATE_FULL),
    })
  );

  function buildHideScheduleButton(extraButtons = []) {
    return {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Skjul skema",
          },
          style: "danger",
          action_id: deleteMessageActionId,
        },
        ...extraButtons,
      ],
    };
  }

  await respond({
    response_type: "ephemeral",
    replace_original: updateOriginal,
    text: formattedObjects
      .map(
        (x) =>
          `${x.date}: head chef <@${x.headChef}> assistent <@${x.assistent}>`
      )
      .join("\n"),
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Torsdagstallerken Program",
        },
      },
      buildHideScheduleButton(),
      {
        type: "rich_text",
        elements: formattedObjects.flatMap((x) => [
          {
            type: "rich_text_list",
            style: "bullet",
            elements: [
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "text",
                    text: `${x.date}: `,
                    style: {
                      bold: true,
                    },
                  },
                ],
              },
            ],
          },
          {
            type: "rich_text_list",
            style: "bullet",
            indent: 1,
            elements: [
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "emoji",
                    name: "chef-parrot",
                  },
                  {
                    type: "text",
                    text: " Head Chef: ",
                    style: {
                      bold: true,
                    },
                  },
                  {
                    type: "user",
                    user_id: x.headChef,
                  },
                ],
              },
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "emoji",
                    name: "cook",
                  },
                  {
                    type: "text",
                    text: " Souschef: ",
                    style: {
                      bold: true,
                    },
                  },
                  {
                    type: "user",
                    user_id: x.assistent,
                  },
                ],
              },
            ],
          },
        ]),
      },
      buildHideScheduleButton(
        hasMore
          ? [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Vis flere",
                },
                action_id: "show-more-dinner-schedule",
                value: endDate.toISO(),
              },
            ]
          : []
      ),
    ],
  });
}

/**
 * @argument thursdayLuxonDateTime {DateTime}
 */
export async function handleThreeDaysBeforeDinner(thursdayLuxonDateTime) {
  if (thursdayLuxonDateTime.weekday !== 4) {
    return;
  }
  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );

  const dbRow = JSON.parse(
    await sheetDbClient.read({
      sheet: TORSDAGS_TALLERKEN_SHEET_NAME,
      search: {
        dato: thursdayLuxonDateTime.toFormat("yyyy-MM-dd"),
        single_object: true,
      },
    })
  );

  const headChef = getUserIdByRowId(dbRow.hovedkok, members);
  const assistent = getUserIdByRowId(dbRow.kokkeassistent, members);

  const firstThirsdayOfTheMonth = thursdayLuxonDateTime.day <= 7;

  // easy helper to change to SLACKBOT_TEST_CHANNEL if testing for example
  const channelToSendTo = TORSDAGS_TALLERKEN_CHANNEL;

  /**
   * @type {(slackBolt.Block | slackBolt.KnownBlock)[]}
   */
  const msgBlocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Torsdagstallerken",
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
              text: "Så er der endnu engang tre dage til torsdagstallerken! I denne uge har vi:\n",
            },
          ],
        },
        {
          type: "rich_text_list",
          style: "bullet",
          elements: [
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "emoji",
                  name: "chef-parrot",
                },
                {
                  type: "text",
                  text: " Head Chef: ",
                  style: {
                    bold: true,
                  },
                },
                {
                  type: "user",
                  user_id: headChef,
                },
              ],
            },
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "emoji",
                  name: "cook",
                },
                {
                  type: "text",
                  text: " Souschef: ",
                  style: {
                    bold: true,
                  },
                },
                {
                  type: "user",
                  user_id: assistent,
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  if (firstThirsdayOfTheMonth) {
    msgBlocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Husmøde*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Husk også at det er første torsdag i måneden, så medmindre andet er aftalt er der også husmøde på torsdag efter spisning",
        },
      }
    );
  }

  msgBlocks.push(
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Svar Udbedes*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "På denne besked må i meget gerne lave en emoji reaktion for at tilkendegive om i tænker i spiser med på torsdag. Det er fint at ændre den senere men prøv så godt du kan at have et endeligt svar på senest torsdag morgen:",
      },
    },
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_list",
          style: "bullet",
          elements: [
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "emoji",
                  name: "white_check_mark",
                },
                {
                  type: "text",
                  text: ": Ja",
                },
              ],
            },
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "emoji",
                  name: "x",
                },
                {
                  type: "text",
                  text: ": Nej",
                },
              ],
            },
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "emoji",
                  name: "yes-no-may-be-so-blob",
                },
                {
                  type: "text",
                  text: ": Stadig usikker/Måske",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: "Jeg sætter også hver af disse emojis på beskeden nu så de er nemme at klikke, og så fjerner jeg mine egne reaktioner igen torsdag morgen så de ikke bliver talt med",
      },
    }
  );

  const reactionMessage = await sendDinnerMessage({
    channel: channelToSendTo,
    blocks: msgBlocks,
    text: "Torsdagstallerken om tre dage!",
  });

  const reactionMessageTimestamp = reactionMessage.ts;
  if (!reactionMessageTimestamp) {
    throw new Error(
      `Didn't get a timestamp back from the reaction message: ${JSON.stringify(
        reactionMessage
      )}`
    );
  }

  const reactionMessageChannelId = reactionMessage.channel;
  if (!reactionMessageChannelId) {
    throw new Error(
      `Didn't get a channel id back from the reaction message: ${JSON.stringify(
        reactionMessage
      )}`
    );
  }

  // On purpose doing it serially, it's nice for the UI that it's always the same order
  // the reactions show up in
  for (const emojiName of ["white_check_mark", "x", "yes-no-may-be-so-blob"]) {
    await slackClient.reactions.add({
      channel: reactionMessageChannelId,
      timestamp: reactionMessageTimestamp,
      name: emojiName,
    });
  }
}
function getUserIdByRowId(rowId, members) {
  const result = members.find((x) => x.id === rowId);
  if (result === undefined) {
    throw new Error("Invalid row id for users");
  }
  return result["slack-id"];
}
/**
 * @argument thursdayLuxonDateTime {DateTime}
 */
export async function handleDayOfDinner(thursdayLuxonDateTime) {
  if (thursdayLuxonDateTime.weekday !== 4) {
    return;
  }

  // easy helper to change to SLACKBOT_TEST_CHANNEL if testing for example
  const channelToSendTo = TORSDAGS_TALLERKEN_CHANNEL;

  const allChannels = await slackClient.conversations.list({
    exclude_archived: true,
  });

  const targetChannelId = allChannels.channels?.find(
    (x) => x.name === channelToSendTo
  )?.id;

  if (!targetChannelId) {
    throw new Error(
      `Couldn't find id of channel ${channelToSendTo} in list of all channels: ${JSON.stringify(
        allChannels
      )}`
    );
  }

  const relevantMessageHistory = await slackClient.conversations.history({
    channel: targetChannelId,
    // latest: thursdayLuxonDateTime.plus({ days: -2 }).toSeconds(),
    // oldest: thursdayLuxonDateTime.plus({ days: -4 }).toSeconds(),
  });

  const mostRecentMessageFromUs = relevantMessageHistory.messages?.find(
    (x) => x.user === THIS_BOT_USER_ID
  );
  if (!mostRecentMessageFromUs) {
    throw new Error(
      `No message found from us to remove reactions from: ${JSON.stringify(
        mostRecentMessageFromUs
      )}`
    );
  }
  const { ts: mostRecentMsgTs, reactions: mostRecentMsgReactions } =
    mostRecentMessageFromUs;
  if (!mostRecentMsgTs || !mostRecentMsgReactions) {
    throw new Error(
      `Missing timestamp or reactions from most recent message from us: ${JSON.stringify(
        mostRecentMessageFromUs
      )}`
    );
  }

  const usersThatHaveReacted = mostRecentMsgReactions.flatMap((x) => x.users);
  const channelMembersResponse = await slackClient.conversations.members({
    channel: targetChannelId,
  });
  const channelMembersThatHaventReacted = channelMembersResponse.members.filter(
    (memberId) =>
      !usersThatHaveReacted.includes(memberId) && memberId !== THIS_BOT_USER_ID
  );

  const channelMembersOnMaybe = (
    mostRecentMsgReactions.find((x) => x.name === "yes-no-may-be-so-blob")
      ?.users ?? []
  ).filter((x) => x !== THIS_BOT_USER_ID);

  await Promise.all(
    ["white_check_mark", "x", "yes-no-may-be-so-blob"].map((emojiName) =>
      slackClient.reactions.remove({
        channel: targetChannelId,
        timestamp: mostRecentMsgTs,
        name: emojiName,
      })
    )
  );

  await sendDinnerMessage({
    channel: channelToSendTo,
    text: "Husk at melde tilbage om du skal med til torsdagstallerken!",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Torsdagstallerken i aften",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Så blev det torsdag! Jeg håber i får en lækker fællesspisning, og husk at opdater jeres svar hvis noget har ændret sig. Jeg kan se der er nogle der mangler at afgive definitivt svar",
        },
      },
      { type: "divider" },
      {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_list",
            style: "bullet",
            elements: [
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "text",
                    text: "Har ikke afgivet noget svar: ",
                    style: {
                      bold: true,
                    },
                  },
                  ...(channelMembersThatHaventReacted.length <= 0
                    ? [
                        {
                          type: "text",
                          text: "Alle har afgivet mindst et svar! ",
                        },
                        { type: "emoji", name: "tada" },
                      ]
                    : richTextNaturalLanguageList(
                        channelMembersThatHaventReacted.map((userId) => ({
                          type: "user",
                          user_id: userId,
                        }))
                      )),
                ],
              },
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "text",
                    text: "Har stemt måske og mangler at afgive endeligt svar: ",
                    style: {
                      bold: true,
                    },
                  },
                  ...(channelMembersOnMaybe.length <= 0
                    ? [
                        {
                          type: "text",
                          text: "Alle stemmer er definitive! ",
                        },
                        { type: "emoji", name: "partying_face" },
                      ]
                    : richTextNaturalLanguageList(
                        channelMembersOnMaybe.map((userId) => ({
                          type: "user",
                          user_id: userId,
                        }))
                      )),
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

import { richTextNaturalLanguageList } from "./utils.js";
import {
  sheetDbClient,
  BEBOERE_SHEET_NAME,
  TORSDAGS_TALLERKEN_SHEET_NAME,
  TORSDAGS_TALLERKEN_CHANNEL,
  slackClient,
  THIS_BOT_USER_ID,
} from "./globals.js";

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

  const reactionMessage = await slackClient.chat.postMessage({
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

  await slackClient.chat.postMessage({
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

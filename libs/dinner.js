import { generateAllPairings, stringNaturalLanguageList } from "./utils.js";
import {
  sheetDbClient,
  BEBOERE_SHEET_NAME,
  MUMSDAG_SHEET_NAME,
  MUMSDAG_CHANNEL_ID,
  THIS_BOT_USER_ID,
  deleteMessageActionId,
  sendDinnerMessage,
  RUNNING_IN_PRODUCTION,
  ARCHIVE_MUMSDAG_SHEET_NAME,
  DISCORD_GUILD_ID,
  cacheInteraction,
  isInteractionValid,
  getInteraction,
  sendMessageToChannel,
  DISCORD_TEST_CHANNEL_ID,
  sendGeneralMessage,
} from "./globals.js";
import { discordClient } from "./globals.js";
import { DateTime, Interval } from "luxon";
import lodashJoins from "lodash-joins";
import _ from "lodash";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  TextChannel,
} from "discord.js";

/**
 * @callback ActionlistenerCb
 * @param {object} obj
 * @param {import("discord.js").Interaction} obj.interaction
 * @param {string} obj.actionValue
 */

/**
 * @type {[string, ActionlistenerCb][]}
 */
export const dinnerActionListeners = [
  [
    "see-dinner-schedule",
    async ({ interaction }) => {
      await handlerDinnerScheduleActionResponse({
        interaction,
        startDate: DateTime.now(),
        endDate: DateTime.now().plus({ weeks: 4 }),
        updateOriginal: false,
      });
    },
  ],
  [
    "show-more-dinner-schedule",
    async ({ interaction, actionValue }) => {
      const [endDateISO, isContinuedMessageString, startDateISO] =
        actionValue.split("#");
      let startDate = DateTime.fromISO(startDateISO);
      const endDate = DateTime.fromISO(endDateISO).plus({ weeks: 4 });
      let isContinuedMessage = isContinuedMessageString === "true";
      let updateOriginal = true;
      let needToSplitMessage = false;
      if (Interval.fromDateTimes(startDate, endDate).length("weeks") > 17) {
        startDate = DateTime.fromISO(endDateISO);
        isContinuedMessage = true;
        updateOriginal = false;
        needToSplitMessage = true;
      }
      await handlerDinnerScheduleActionResponse({
        interaction,
        startDate,
        endDate,
        updateOriginal,
        isContinuedMessage,
      });
      if (needToSplitMessage) {
        await handlerDinnerScheduleActionResponse({
          interaction,
          startDate: DateTime.fromISO(startDateISO),
          endDate: DateTime.fromISO(endDateISO),
          updateOriginal: true,
          isContinuedMessage: isContinuedMessageString === "true",
          disableShowMore: true,
          replyAlreadyAckhnowledged: true,
        });
      }
    },
  ],
  [
    "edit-dinner-schedule",
    async ({ interaction }) => {
      await interaction.reply({
        ephemeral: true,
        content: `Det kan godt være det følgende virker lidt skræmmende for en ikke teknisk person, men jeg ved du godt kan klare det, og bare rolig hvis noget går galt så fikser vi det bare igen, ingen fare overhovedet :heart:.

For at beholde så meget fleksibilitet som muligt har vi valgt at den bedste måde, trods lidt kompleksitet, er at rette direkte i vores "database." Vi har dog heldigvis bare brugt Google Sheets som vores database for at forhåbentligt gøre det så nemt som muligt at rette i. Tryk på knappen nedenfor for at gå til regnearket, hvor du først vil se den mere menneskelæselige version hvor du kan få overblik over hvordan du vil rette. Når du så rent faktisk skal rette går du over til "${MUMSDAG_SHEET_NAME}" arket, dette er også tydeligt markeret i regnearket, og her kan du så lave de rent faktiske database rettelser. Computere er dumme så det er vigtigt her at du følger formatet med at bruge tal til at referere til os beboere og at datoerne er i År-Måned-Dato format, men som vi skrev ovenfor, bare stol på dig selv, det skal nok gå, og hvis noget går galt så fikser de mere tekniske personer i kollektivet det bare. Der er intet der er i fare for at blive fuldstændig ødelagt, vi kan altid finde tilbage til den tilstand den var i før.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Gå til database regnearket")
              .setStyle(ButtonStyle.Link)
              .setURL(
                "https://docs.google.com/spreadsheets/d/12BjvaehXZyt2CI_rqfexB6pXbZcACS4x3iKM7xMaMOI/edit?usp=sharing&gid=451251755"
              )
          ),
        ],
      });
    },
  ],
];

/**
 * @param {object} obj
 * @param {import("discord.js").Interaction} obj.interaction
 * @param {DateTime} obj.startDate
 * @param {DateTime} obj.endDate
 * @param {boolean} obj.updateOriginal
 * @param {boolean} [obj.isContinuedMessage=false]
 * @param {boolean} [obj.disableShowMore=false]
 * @param {boolean} [obj.replyAlreadyAckhnowledged=false]
 */
async function handlerDinnerScheduleActionResponse({
  interaction,
  startDate,
  endDate,
  updateOriginal,
  isContinuedMessage = false,
  disableShowMore = false,
  replyAlreadyAckhnowledged = false,
}) {
  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );

  const allDbRows = JSON.parse(
    await sheetDbClient.read({
      sheet: MUMSDAG_SHEET_NAME,
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
      headChefDiscordString: headChef["discord-id"]
        ? "<@" + headChef["discord-id"] + ">"
        : "**" + headChef["navn"] + "**",
      assistentDiscordString: memb["discord-id"]
        ? "<@" + memb["discord-id"] + ">"
        : "**" + memb["navn"] + "**",
      date: DateTime.fromISO(headChef.dato)
        .setLocale("da-dk")
        .toLocaleString(DateTime.DATE_FULL),
      sortableDateString: headChef.dato,
    })
  );

  const orderedFormattedObjects = _.sortBy(
    formattedObjects,
    "sortableDateString"
  );

  const content = `\
# ${
    isContinuedMessage
      ? "Fortsat Mumsdag Program\n\nDer er en makslængde på beskeder i Discord så jeg blev nødt til at splitte skemaet op i flere beskeder"
      : "Mumsdag Program"
  }

${orderedFormattedObjects
  .map(
    (x) => `\
- **${x.date}:**
  - :cook: **Head Chef:** ${x.headChefDiscordString}
  - :cook: **Souschef:** ${x.assistentDiscordString}`
  )
  .join("\n")}`;

  const actionRow = new ActionRowBuilder();
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(
        "show-more-dinner-schedule*" +
          endDate.toISO() +
          "#" +
          isContinuedMessage.toString() +
          "#" +
          startDate.toISO()
      )
      .setLabel("Vis flere")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableShowMore || !hasMore)
  );

  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(deleteMessageActionId)
      .setLabel("Skjul skema")
      .setStyle(ButtonStyle.Danger)
  );

  if (updateOriginal) {
    const messageId = interaction.message.id;
    const oldInteraction = getInteraction(messageId);
    if (!isInteractionValid(messageId) || oldInteraction === undefined) {
      if (replyAlreadyAckhnowledged) {
        return;
      }
      await interaction.reply({
        content,
        components: [actionRow],
        ephemeral: true,
      });
      await interaction.followUp({
        content:
          "Da Discord ikke tillader at opdatere beskeder der er over 15 minutter gamle, så har jeg istedet sendt dig en ny besked",
        ephemeral: true,
      });
      const reply = await interaction.fetchReply();
      cacheInteraction({
        timestamp: reply.createdTimestamp,
        interaction,
        messageId: reply.id,
      });
      return;
    }

    if (!replyAlreadyAckhnowledged) {
      await interaction.deferUpdate();
    }
    await oldInteraction.editReply({
      content,
      components: [actionRow],
    });
  } else {
    await interaction.reply({
      content,
      components: [actionRow],
      ephemeral: true,
    });
    const reply = await interaction.fetchReply();
    cacheInteraction({
      timestamp: reply.createdTimestamp,
      interaction,
      messageId: reply.id,
    });
  }
}

/**
 * @argument {DateTime} onsdagLuxonDateTime
 */
export async function handleThreeDaysBeforeDinner(onsdagLuxonDateTime) {
  if (onsdagLuxonDateTime.weekday !== 3) {
    return;
  }
  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );

  if (RUNNING_IN_PRODUCTION) {
    const allDinnerRows = JSON.parse(
      await sheetDbClient.read({
        sheet: MUMSDAG_SHEET_NAME,
      })
    );

    const maxDateRow = _.maxBy(allDinnerRows, "dato");
    if (
      maxDateRow.dato <
      onsdagLuxonDateTime.plus({ months: 3 }).toFormat("yyyy-MM-dd")
    ) {
      const nextPairings = generateAllPairings(10);
      if (members.length !== 10) {
        await sendMessageToChannel({
          channelId: DISCORD_TEST_CHANNEL_ID,
          message:
            "There were not 10 members in the database when trying to generate new dinner pairings. Instead there were " +
            members.length,
        });
        return;
      }

      let curDate = DateTime.fromISO(maxDateRow.dato);
      await sheetDbClient.create(
        nextPairings.map((x) => {
          curDate = curDate.plus({ weeks: 1 });
          return {
            dato: curDate.toFormat("yyyy-MM-dd"),
            hovedkok: x[0],
            kokkeassistent: x[1],
          };
        }),
        MUMSDAG_SHEET_NAME
      );

      await sendGeneralMessage(
        `# Ny madlavningsplan!

Der er nu madlavningsplan indtil ${curDate
          .setLocale("da-DK")
          .toFormat(
            "'d.' dd. MMMM yyyy"
          )} da vi var tre måneder fra at være færdige med den gamle. Du kan se planen ved at trykke på se flere handlinger.`
      );
    }

    for (const x of allDinnerRows) {
      if (x.dato < onsdagLuxonDateTime.toFormat("yyyy-MM-dd")) {
        await sheetDbClient.create(x, ARCHIVE_MUMSDAG_SHEET_NAME);
        await sheetDbClient.delete("dato", x.dato, MUMSDAG_SHEET_NAME);
      }
    }
  }

  const dbRow = JSON.parse(
    await sheetDbClient.read({
      sheet: MUMSDAG_SHEET_NAME,
      search: {
        dato: onsdagLuxonDateTime.toFormat("yyyy-MM-dd"),
        single_object: true,
      },
    })
  );

  const headChef = getUserByRowId(dbRow.hovedkok, members);
  const assistent = getUserByRowId(dbRow.kokkeassistent, members);

  const msgLines = [
    "# Mumsdag",
    "",
    "Så er der endnu engang tre dage til mumsdag! I denne uge har vi:",
    `- :cook: **Head Chef:** ${
      headChef["discord-id"]
        ? "<@" + headChef["discord-id"] + ">"
        : "**" + headChef["navn"] + "**"
    }`,
    `- :cook: **Souschef:** ${
      assistent["discord-id"]
        ? "<@" + assistent["discord-id"] + ">"
        : "**" + assistent["navn"] + "**"
    }`,
    "## Svar Udbedes",
    "På denne besked må i meget gerne lave en emoji reaktion for at tilkendegive om i tænker i spiser med på onsdag. Det er fint at ændre den senere men prøv så godt du kan at have et endeligt svar på senest onsdag morgen:",
    "- :white_check_mark:: Ja",
    "- :x:: Nej",
    "- <a:yes_no_may_be_so_blob:1290015813608144956>: Stadig usikker/Måske",
    "",
    "Jeg sætter også hver af disse emojis på beskeden nu så de er nemme at klikke, og så fjerner jeg mine egne reaktioner igen onsdag morgen så de ikke bliver talt med",
  ];

  const reactionMessage = await sendDinnerMessage(msgLines.join("\n"));

  // On purpose doing it serially, it's nice for the UI that it's always the same order
  // the reactions show up in
  for (const emoji of ["✅", "❌", "1290015813608144956"]) {
    await reactionMessage.react(emoji);
  }
}
function getUserByRowId(rowId, members) {
  const result = members.find((x) => x.id === rowId);
  if (result === undefined) {
    throw new Error("Invalid row id for users");
  }
  return result;
}
/**
 * @argument thursdayLuxonDateTime {DateTime}
 */
export async function handleDayOfDinner(thursdayLuxonDateTime) {
  if (thursdayLuxonDateTime.weekday !== 3) {
    return;
  }

  const channel = await discordClient.channels.fetch(MUMSDAG_CHANNEL_ID);

  if (channel === null || !(channel instanceof TextChannel)) {
    throw new Error("Channel not found: " + MUMSDAG_CHANNEL_ID);
  }

  // fetch channel messages in reverse chronological order

  const messages = await channel.messages.fetch({
    limit: 100,
  });

  /**
   * @type {Message<true> | undefined}
   */
  const mostRecentMessageFromUs = messages.find(
    (x) => x.author.id === THIS_BOT_USER_ID
  );

  if (mostRecentMessageFromUs === undefined) {
    throw new Error("No message found from us to remove reactions from");
  }

  const reactions = [...mostRecentMessageFromUs.reactions.cache.values()];
  const ourReactions = reactions.filter((x) => x.me);
  await Promise.all(
    ourReactions.map((reaction) => reaction.users.remove(THIS_BOT_USER_ID))
  );

  const usersThatHaveReacted = (
    await Promise.all(reactions.map((x) => x.users.fetch()))
  ).flatMap((x) => [...x.values()]);

  const members = JSON.parse(
    await sheetDbClient.read({ sheet: BEBOERE_SHEET_NAME })
  );
  const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
  const guildUserMembers = [...(await guild.members.fetch()).values()]
    .map((x) => x.user)
    .filter((x) => members.find((y) => y["discord-id"] === x.id) !== undefined);

  const membersThatHaventReacted = guildUserMembers.filter(
    (x) => !usersThatHaveReacted.map((y) => y.id).includes(x.id)
  );

  const maybeReaction = reactions.find(
    (x) => x.emoji.id === "1290015813608144956"
  );
  if (maybeReaction === undefined) {
    throw new Error("No maybe reaction found");
  }

  const membersWithMaybeReaction = [
    ...(await maybeReaction.users.fetch()).values(),
  ].filter((x) => members.find((y) => y["discord-id"] === x.id) !== undefined);
  await sendDinnerMessage(
    `
# Mumsdag i aften

Så blev det onsdag! Jeg håber i får en lækker fællesspisning, og husk at opdater jeres svar hvis noget har ændret sig. Herunder kan i se status for folk der mangler at afgive definitive svar

- **Har ikke afgivet noget svar:** ${
      membersThatHaventReacted.length <= 0
        ? "Alle har afgivet mindst et svar! :tada:"
        : stringNaturalLanguageList(
            membersThatHaventReacted.map((user) => `<@${user.id}>`)
          )
    }
- **Har stemt måske og mangler at afgive endeligt svar:** ${
      membersWithMaybeReaction.length <= 0
        ? "Alle stemmer er definitive! :partying_face:"
        : stringNaturalLanguageList(
            membersWithMaybeReaction.map((user) => `<@${user.id}>`)
          )
    }
`
  );
}

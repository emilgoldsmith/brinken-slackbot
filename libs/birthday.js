import _ from "lodash";
import { DateTime } from "luxon";
import {
  sheetDbClient,
  BEBOERE_SHEET_NAME,
  deleteMessageActionId,
  sendBirthdayMessage,
  RUNNING_IN_PRODUCTION,
  cacheInteraction,
  sendMessageToChannel,
  DISCORD_TEST_CHANNEL_ID,
  discordClient,
  DISCORD_TEST_CHANNEL_NAME,
  DISCORD_GUILD_ID,
  THIS_BOT_USER_ID,
} from "./globals.js";
import { ActionRowBuilder, ButtonBuilder } from "@discordjs/builders";
import { ButtonStyle, ChannelType, PermissionsBitField } from "discord.js";

/**
 * @callback ActionlistenerCb
 * @param {object} obj
 * @param {import("discord.js").Interaction} obj.interaction
 * @param {string} obj.actionValue
 */

/**
 * @type {[string, ActionlistenerCb][]}
 */
export const birthdayActionListeners = [
  [
    "see-birthday-schedule",
    async ({ interaction }) => {
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

      await interaction.reply({
        ephemeral: true,
        content: `\
# Næste Års Fødselsdage

${sortedBirthdays
  .map(
    (x) => `\
- :flag_dk: d. **${DateTime.fromISO(x.fødselsdag)
      .setLocale("da-DK")
      .toFormat("dd. MMMM")}** bliver ${
      x["discord-id"] ? "<@" + x["discord-id"] + ">" : "**" + x["navn"] + "**"
    } ${x.nextAge} år :flag_dk:`
  )
  .join("\n")}`,
        components: [
          new ActionRowBuilder().addComponents([
            new ButtonBuilder()
              .setCustomId(deleteMessageActionId)
              .setLabel("Skjul besked")
              .setStyle(ButtonStyle.Danger),
          ]),
        ],
      });
      const reply = await interaction.fetchReply();
      cacheInteraction({
        timestamp: reply.createdTimestamp,
        interaction,
        messageId: reply.id,
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
    await sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message:
        "'Impossible' error occurred, couldn't find birthday person after finding birthday people",
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
    await sendMessageToChannel({
      channel: DISCORD_TEST_CHANNEL_ID,
      text: `Couldn't find any responsible people for the birthday. Sorted birthdays: ${JSON.stringify(
        sortedBirthdays
      )}`,
    });
    return;
  }

  const birthdayCelebrators = members
    .filter((m) => !birthdayPeople.map((p) => p.id).includes(m.id))
    .filter((x) => x["discord-id"]);

  const birthdayChannelName = buildBirthdayChannelName(
    birthdayPeople,
    birthdayYear,
    channelNameSuffix
  );

  /**
   * @type string
   */
  let birthdayChannelId = DISCORD_TEST_CHANNEL_ID;

  if (RUNNING_IN_PRODUCTION) {
    const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
    await guild.members.fetch();
    const channel = await guild.channels.create({
      type: ChannelType.GuildText,
      name: birthdayChannelName,
      permissionOverwrites: [
        ...birthdayCelebrators.map((x) => ({
          type: "member",
          id: x["discord-id"],
          allow: [PermissionsBitField.Flags.ViewChannel],
        })),
        {
          type: "member",
          id: THIS_BOT_USER_ID,
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          type: "role",
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
    });
    birthdayChannelId = channel.id;
  }

  await sendBirthdayMessage({
    channelId: birthdayChannelId,
    message: `# :flag_dk: :flag_dk: :flag_dk: Der er fødselsdag i kollektivet! :flag_dk: :flag_dk: :flag_dk:

Så blev det fødselsdagstid igen! Denne gang har vi:

${birthdayPeople
  .map(
    (x) =>
      `- ${
        x["discord-id"] ? "<@" + x["discord-id"] + ">" : "**" + x["navn"] + "**"
      } der bliver ${x.nextAge} år gammel`
  )
  .join("\n")}\n\nDe har fødselsdag om en uge ${DateTime.fromFormat(
      targetBirthdayMMDD,
      "MM-dd"
    )
      .setLocale("da-DK")
      .toFormat(
        "EEEE 'd.' dd. MMMM"
      )}, og de hovedansvarlige for fødselsdag morgenmad er:
      ${responsiblePeople.map(
        (x) =>
          `- ${
            x["discord-id"]
              ? "<@" + x["discord-id"] + ">"
              : "**" + x["navn"] + "**"
          }`
      )}`,
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

  const guild = await discordClient.guilds.fetch(DISCORD_GUILD_ID);
  const channels = await guild.channels.fetch();
  const channel = channels.find(
    (channel) => channel.name === birthdayChannelName
  );

  if (channel === undefined) {
    await sendMessageToChannel({
      channelId: DISCORD_TEST_CHANNEL_ID,
      message: "Couldn't find the channel with name " + birthdayChannelName,
    });
    return;
  }

  await sendBirthdayMessage({
    channelId: channel.id,
    message: `# Fødselsdag i morgen!

@everyone`,
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
  if (!RUNNING_IN_PRODUCTION) {
    return DISCORD_TEST_CHANNEL_NAME;
  }
  return (
    birthdayPeople.map((x) => x.navn.toLowerCase()).join("-") +
    `-fødselsdag-${birthdayYear}` +
    (channelNameSuffix ? "-" + channelNameSuffix : "")
  );
}

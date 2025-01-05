import sheetdb from "sheetdb-node";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  TextChannel,
} from "discord.js";

export const DISCORD_GUILD_ID = "1276132880552034446";
export const DISCORD_TEST_CHANNEL_ID = "1289988414476779671";
export const DISCORD_TEST_CHANNEL_NAME = "brinkenbot-test";
export const DISCORD_CLIENT_ID = "1289978773764309112";

export const BEBOERE_SHEET_NAME = "Beboere";
export const MUMSDAG_SHEET_NAME = "Torsdagstallerken";
export const ARCHIVE_MUMSDAG_SHEET_NAME = "Torsdagstallerkensarkiv";
export const RUNNING_IN_PRODUCTION = process.env.RENDER === "true";
export const MUMSDAG_CHANNEL_ID = RUNNING_IN_PRODUCTION
  ? "1325490174909612124"
  : DISCORD_TEST_CHANNEL_ID;
export const GENERAL_CHANNEL_ID = RUNNING_IN_PRODUCTION
  ? "1276132881000828939"
  : DISCORD_TEST_CHANNEL_ID;
export const THIS_BOT_USER_ID = "1289978773764309112";

export const deleteMessageActionId = "delete-message";

export const sheetDbClient = sheetdb({
  address: "jp1hjy317fz23",
  auth_login: process.env.SHEET_DB_LOGIN,
  auth_password: process.env.SHEET_DB_PASSWORD,
});

/**
 * @type {Client<true>}
 */
export let discordClient;

/**
 * @param {Client<true>} newClient
 */
export function setDiscordClient(newClient) {
  discordClient = newClient;
}

/**
 * @type {[string, (params: {interaction: import("discord.js").Interaction, actionValue: string}) => Promise<void>][]}
 */
export const globalActionListeners = [
  [
    deleteMessageActionId,
    async ({ interaction }) => {
      if (interaction.message.interactionMetadata) {
        const oldInteraction = getInteraction(interaction.message.id);
        if (isInteractionValid(interaction.message.id) && oldInteraction) {
          await interaction.deferUpdate();
          await oldInteraction.deleteReply();
          return;
        }
        await interaction.reply({
          content:
            "Discord tillader kun for mig at slette beskeder for dig indenfor 15 minutter af at de er blevet sendt, så du bliver desværre nødt til at håndtere den her selv. Lige under beskeden skulle der gerne stå at kun du kan se beskeden, og så et link der lader dig fjerne beskeden",
          ephemeral: true,
        });
        return;
      }
      await interaction.deferUpdate();
      await interaction.message.delete();
    },
  ],
  [
    "see-more-actions",
    async ({ interaction, actionValue }) => {
      await interaction.reply({
        ephemeral: true,
        content: "Flere handlinger",
        components: [
          ...getMoreButtons(actionValue),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Skjul besked")
              .setStyle(ButtonStyle.Danger)
              .setCustomId(deleteMessageActionId)
          ),
        ],
      });
    },
  ],
];

/**
 * @param {object} obj
 * @param {string} obj.channelId
 * @param {string} obj.message
 * @param {import("discord.js").BaseMessageOptions["components"]} obj.components
 */
export async function sendMessageToChannel({ channelId, message, components }) {
  const channel = await discordClient.channels.fetch(channelId);
  if (!(channel instanceof TextChannel)) {
    throw new Error("Channel is not a text channel: " + channelId);
  }
  return channel.send({ content: message, components });
}

/**
 * @type {import("discord.js").ButtonBuilder[]}
 */
const dinnerButtons = [
  new ButtonBuilder()
    .setCustomId("see-dinner-schedule")
    .setLabel("Se skema")
    .setStyle(ButtonStyle.Primary),
  new ButtonBuilder()
    .setCustomId("edit-dinner-schedule")
    .setLabel("Ret skema")
    .setStyle(ButtonStyle.Primary),
];

/**
 * @param {string} message
 */
export function sendDinnerMessage(message) {
  return sendMessageToChannel({
    channelId: MUMSDAG_CHANNEL_ID,
    message,
    components: [
      new ActionRowBuilder().addComponents(
        ...dinnerButtons,
        getSeeMoreActionsButton("dinner")
      ),
    ],
  });
}

const birthdayButtons = [
  new ButtonBuilder()
    .setCustomId("see-birthday-schedule")
    .setLabel("Se alle fødselsdage")
    .setStyle(ButtonStyle.Primary),
];

/**
 * @param {object} obj
 * @param {string} obj.message
 * @param {string} obj.channelId
 */
export function sendBirthdayMessage({ message, channelId }) {
  return sendMessageToChannel({
    channelId,
    message,
    components: [
      new ActionRowBuilder().addComponents(
        ...birthdayButtons,
        getSeeMoreActionsButton("birthday")
      ),
    ],
  });
}

/**
 * @param {'dinner' | 'birthday'} type
 */
function getSeeMoreActionsButton(type) {
  return new ButtonBuilder()
    .setCustomId(`see-more-actions*${type}`)
    .setLabel("Se flere handlinger")
    .setStyle(ButtonStyle.Secondary);
}

/**
 * @param {'dinner' | 'birthday' | 'none'} exclude
 * @returns {ActionRowBuilder[]}
 */
export function getMoreButtons(exclude) {
  /**
   * @type {ActionRowBuilder[]}
   */
  const ret = [];
  if (exclude !== "dinner") {
    ret.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Mumsdag Handlinger:")
          .setStyle(ButtonStyle.Secondary)
          .setCustomId("title-dinner")
          .setDisabled(true),
        ...dinnerButtons
      )
    );
  }
  if (exclude !== "birthday") {
    ret.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Fødselsdag Handlinger:")
          .setStyle(ButtonStyle.Secondary)
          .setCustomId("title-birthday")
          .setDisabled(true),
        ...birthdayButtons
      )
    );
  }
  if (exclude === "none") {
    ret.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(deleteMessageActionId)
          .setLabel("Skjul besked")
          .setStyle(ButtonStyle.Danger)
      )
    );
  }
  return ret;
}

const interactionCache = new Map();

export function isInteractionValid(messageId) {
  const timestamp = interactionCache.get(messageId)?.[0];
  if (!timestamp) {
    return false;
  }
  return Date.now() - timestamp < 15 * 60 * 1000 - 1000;
}

export function getInteraction(messageId) {
  return interactionCache.get(messageId)?.[1];
}

export function cacheInteraction({ timestamp, interaction, messageId }) {
  interactionCache.set(messageId, [timestamp, interaction]);
}

export function clearOutdatedInteractionsInCache() {
  interactionCache.forEach((_, messageId) => {
    if (!isInteractionValid(messageId)) {
      if (!interactionCache.delete(messageId)) {
        sendMessageToChannel({
          channelId,
          DISCORD_TEST_CHANNEL_ID,
          message:
            "Failed to delete outdated interaction from cache. Message id: " +
            messageId,
        }).catch(console.error);
      }
    }
  });
}

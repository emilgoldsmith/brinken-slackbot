import slackBolt from "@slack/bolt";
import sheetdb from "sheetdb-node";

export const SLACKBOT_TEST_CHANNEL = "slackbot-test";
export const BEBOERE_SHEET_NAME = "Beboere";
export const TORSDAGS_TALLERKEN_SHEET_NAME = "Torsdagstallerken";
export const TORSDAGS_TALLERKEN_CHANNEL =
  process.env.RENDER === "true" ? "fællesspisning" : SLACKBOT_TEST_CHANNEL;
export const THIS_BOT_USER_ID = "U07773D070B";

export const deleteMessageActionId = "delete-message";
export const justAcknowledgeResponseActionId = "just-acknowledge-response";

export const sheetDbClient = sheetdb({
  address: "jp1hjy317fz23",
  auth_login: process.env.SHEET_DB_LOGIN,
  auth_password: process.env.SHEET_DB_PASSWORD,
});

export const slackClient = new slackBolt.App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
}).client;

/**
 * @type {[string, slackBolt.Middleware<slackBolt.SlackActionMiddlewareArgs<slackBolt.SlackAction>][]}
 */
export const globalActionListeners = [
  [
    deleteMessageActionId,
    async ({ ack, respond }) => {
      await ack();
      await respond({ delete_original: true });
    },
  ],
  [
    justAcknowledgeResponseActionId,
    async ({ ack }) => {
      await ack();
    },
  ],
];

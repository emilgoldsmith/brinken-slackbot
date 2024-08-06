import slackBolt from "@slack/bolt";
import sheetdb from "sheetdb-node";

export const SLACKBOT_TEST_CHANNEL = "slackbot-test";
export const BEBOERE_SHEET_NAME = "Beboere";
export const TORSDAGS_TALLERKEN_SHEET_NAME = "Torsdagstallerken";
export const RUNNING_IN_PRODUCTION = process.env.RENDER === "true";
export const TORSDAGS_TALLERKEN_CHANNEL = RUNNING_IN_PRODUCTION
  ? "fællesspisning"
  : SLACKBOT_TEST_CHANNEL;
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
  [
    "see-more-actions",
    async ({ ack, respond, action }) => {
      await ack();
      await respond({
        response_type: "ephemeral",
        replace_original: false,
        text: "Flere handlinger",
        blocks: [
          ...getMoreButtons(action.value),
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

const dinnerButtons = [
  {
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
  },
];
/**
 * @param {object} obj
 * @param {string} obj.text
 * @param {(slackBolt.Block | slackBolt.KnownBlock)[]} obj.blocks
 * @param {string} obj.channel
 */
export function sendDinnerMessage({ text, blocks, channel }) {
  return slackClient.chat.postMessage({
    channel,
    text,
    blocks: [...blocks, ...dinnerButtons, getSeeMoreActionsButton("dinner")],
  });
}

const birthdayButtons = [
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
export function sendBirthdayMessage({ text, blocks, channel }) {
  return slackClient.chat.postMessage({
    channel,
    text,
    blocks: [
      ...blocks,
      ...birthdayButtons,
      getSeeMoreActionsButton("birthday"),
    ],
  });
}

/**
 * @param {'dinner' | 'birthday'} type
 */
function getSeeMoreActionsButton(type) {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Se flere handlinger",
        },
        action_id: "see-more-actions",
        value: type,
      },
    ],
  };
}

/**
 * @param {'dinner' | 'birthday'} exclude
 * @returns {(slackBolt.Block | slackBolt.KnownBlock)[]}
 */
function getMoreButtons(exclude) {
  return [
    ...(exclude === "dinner"
      ? []
      : [
          { type: "divider" },
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "text",
                    text: "Torsdagstallerkenshandlinger",
                    style: {
                      bold: true,
                    },
                  },
                ],
              },
            ],
          },
          ...dinnerButtons,
        ]),
    ...(exclude === "birthday"
      ? []
      : [
          { type: "divider" },
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "text",
                    text: "Fødselsdagshandlinger",
                    style: {
                      bold: true,
                    },
                  },
                ],
              },
            ],
          },
          ...birthdayButtons,
        ]),
    { type: "divider" },
  ];
}

import {
  handleWeekBeforeBirthday,
  handleDayBeforeBirthday,
} from "./birthday.js";
import { randomBytes } from "crypto";

export function brinkenbotTestSlashCommand() {
  return async ({ command, ack, respond }) => {
    await ack();
    try {
      const params = command.text
        .split(" ")
        .map((x) => x.trim())
        .filter((x) => x);
      if (params.length <= 0) {
        await respond({
          text: `Her er dine muligheder for tests du kan bede om:

1. \`/brinkenbot-test føds uge [MM-DD]\` så for eksempel \`/brinkenbot-test føds uge 05-26\`
2. \`/brinkenbot-test føds dag [kanal-navn]\``,
        });
        return;
      }

      const testName = params[0];
      switch (testName) {
        case "føds": {
          if (params.length < 2) {
            await respond({
              text: "Inkorrekt føds kommando, der skal være en underkommando der enten er `uge` eller `dag`",
            });
            return;
          }
          const subCommand = params[1];
          if (subCommand === "uge") {
            if (params.length !== 3) {
              await respond({
                text: "Inkorrekt føds uge kommando, forventede `/brinkenbot-test føds uge [MM-DD]` format",
              });
              return;
            }
            const targetBirthdayMMDD = params[2];
            await handleWeekBeforeBirthday(
              targetBirthdayMMDD,
              randomBytes(5).toString("hex")
            );
          } else if (subCommand === "dag") {
            if (params.length !== 3) {
              await respond({
                text: "Inkorrekt føds dag kommando, forventede `/brinkenbot-test føds dag [kanal-navn]` format",
              });
              return;
            }
            const channelName = params[2];
            await handleDayBeforeBirthday("", channelName);
          } else {
            await respond({
              text:
                "Inkorrekt føds underkommando `" +
                subCommand +
                "`, eneste muligheder er `uge` eller `dag`",
            });
            return;
          }
          break;
        }

        default: {
          await respond({
            text: `Uventet test \`${testName}\`, eneste understøttede mulighed p.t. er \`føds\``,
          });
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.stack : JSON.stringify(e);
      await respond({
        text: `Uventet fejl: ${errorMessage}`,
      });
    }
  };
}

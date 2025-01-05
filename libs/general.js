import { DateTime } from "luxon";
import { sendGeneralMessage } from "./globals.js";

/**
 * @argument {DateTime} targetLuxonDateTime
 */
export function handleTwoDaysBeforeHouseMeeting(targetLuxonDateTime) {
  const firstWednesdayOfTheMonth =
    targetLuxonDateTime.day <= 7 && targetLuxonDateTime.weekday === 3;
  if (firstWednesdayOfTheMonth) {
    sendGeneralMessage(
      `## Husmøde
Husk at det er husmøde i overmorgen på onsdag, da det er den første onsdag i måneden, så medmindre andet er aftalt er der også husmøde på onsdag efter spisning`
    );
  }
}

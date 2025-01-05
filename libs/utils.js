import _ from "lodash";

export function stringNaturalLanguageList(items) {
  if (items.length <= 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  return (
    items.slice(0, items.length - 1).join(", ") +
    ` og ${items[items.length - 1]}`
  );
}

/**
 * @argument items {any[]}
 */
export function richTextNaturalLanguageList(items) {
  if (items.length <= 0) {
    return [];
  }
  if (items.length === 1) {
    return [items[0]];
  }
  const result = [];
  items.forEach((value, index) => {
    result.push(value);
    if (index < items.length - 2) {
      result.push({ type: "text", text: ", " });
    } else if (index === items.length - 2) {
      result.push({ type: "text", text: " og " });
    }
  });
  return result;
}

/**
 * Inspired by https://math.stackexchange.com/questions/34328/how-to-rotate-n-individuals-at-a-dinner-party-so-that-every-guest-meets-every-ot
 */
export function generateAllPairings(n) {
  if (n !== 10) {
    throw new Error(
      "Only N = 10 supported for now. Hasn't been tested or adapted for other N"
    );
  }

  const topRow = [];
  const bottomRow = [];

  for (let i = 0; i < n / 2; i++) {
    topRow.push(i);
    bottomRow.push(i + n / 2);
  }

  const matches = [];

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n / 2; j++) {
      matches.push([topRow[j], bottomRow[j]]);
    }

    // Instead of being mathematically "smart" about it we just simulate
    // the actual changing of seats:
    // Get last person in top row
    const xTop = topRow.pop();
    // Get first person in bottom row and shift everyone else one to the left
    const xBottom = bottomRow.shift();
    // Add the first person from the bottom row and shift everyone else one to the right
    topRow.unshift(xBottom);
    // Move the first person from the bottom row one to the right as we only cycle everyone
    // but the person sitting at the top left
    topRow[1] = topRow[0];
    // Reset the person at the top left to the top left position, we know this is always index 0
    topRow[0] = 0;
    // Add the last person from the top row to the bottom row right most position
    bottomRow.push(xTop);
    // This should result in a cycle of everyone but the top right person of one step in a clockwise direction
  }

  let numFirsts = {};
  let iterations = 0;
  let success = false;
  while (!success) {
    iterations++;
    numFirsts = {};
    for (let i = 0; i < n; i++) numFirsts[i] = 0;
    for (const x of matches) {
      if (Math.random() > 0.5) {
        [x[0], x[1]] = [x[1], x[0]];
      }
      numFirsts[x[0]]++;
    }

    success = _.every(numFirsts, (value) => value === 4 || value === 5);
  }

  return matches.map((x) => x.map((y) => y + 1));
}

export function stringifyDiscordClass(discordClass) {
  return JSON.stringify(
    discordClass.toJSON(),
    (_key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
  );
}

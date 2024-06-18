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

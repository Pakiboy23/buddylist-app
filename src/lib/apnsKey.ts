function stripWrappingQuotes(value: string) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }

  return value;
}

export function normalizeApplePushPrivateKey(value: string) {
  return stripWrappingQuotes(value.trim()).replace(/\\n/g, '\n').trim();
}

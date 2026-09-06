export function isEarlierLocalDay(timestamp: number, referenceTimestamp: number): boolean {
  const value = new Date(timestamp);
  const reference = new Date(referenceTimestamp);

  const valueDay = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const referenceDay = Date.UTC(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );

  return valueDay < referenceDay;
}

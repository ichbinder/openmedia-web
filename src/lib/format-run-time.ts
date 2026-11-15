const TIME_ZONE = "Europe/Berlin";

function dayKey(date: Date) {
  return date.toLocaleDateString("de-DE", { timeZone: TIME_ZONE });
}

export function formatRunTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("de-DE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  if (dayKey(date) === dayKey(now)) return `heute ${time}`;
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86_400_000))) return `gestern ${time}`;
  return `${dayKey(date)} ${time}`;
}

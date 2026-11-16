export function existingParticipantId<T extends { id: string; display_name: string }>(
  rows: T[], storedId: string | null, name: string,
): string | null {
  const stored = rows.find((row) => row.id === storedId);
  if (stored) return stored.id;
  const normalized = name.trim().toLowerCase();
  return rows.find((row) => row.display_name.trim().toLowerCase() === normalized)?.id ?? null;
}

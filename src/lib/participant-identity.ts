export function existingParticipantId<T extends { id: string; display_name: string }>(
  rows: T[], storedId: string | null, _name: string,
): string | null {
  return rows.find((row) => row.id === storedId)?.id ?? null;
}

const pendingJoins = new Map<string, Promise<string>>();

/** Claim one row per browser and room, including across StrictMode mounts and tabs. */
export function joinParticipant(
  roomId: string,
  storage: Pick<Storage, "getItem" | "setItem">,
  insert: (id: string) => Promise<void>,
  find: (id: string) => Promise<boolean>,
  makeId: () => string = () => crypto.randomUUID(),
  locks?: { request(name: string, callback: () => Promise<string>): Promise<string> },
): Promise<string> {
  const pending = pendingJoins.get(roomId);
  if (pending) return pending;
  const key = `cartoonist_participant_${roomId}`;
  const claim = async () => {
    let id = storage.getItem(key);
    if (!id) {
      id = makeId();
      storage.setItem(key, id);
    }
    if (!await find(id)) {
      try { await insert(id); }
      catch (error) {
        // A second tab may have inserted the same reserved id first.
        if (!await find(id)) throw error;
      }
    }
    return id;
  };
  const result = locks ? locks.request(key, claim) : claim();
  pendingJoins.set(roomId, result);
  void result.finally(() => { if (pendingJoins.get(roomId) === result) pendingJoins.delete(roomId); }).catch(() => {});
  return result;
}

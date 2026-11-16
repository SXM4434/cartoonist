export async function loadOptionalAgentEvents<T>(
  load: () => Promise<T>,
  onLoaded: (rows: T) => void,
  isActive: () => boolean,
  source: string,
): Promise<void> {
  try {
    const rows = await load();
    if (isActive()) onLoaded(rows);
  } catch (error) {
    if (isActive()) console.error(`[${source}] could not load agent events`, error);
  }
}

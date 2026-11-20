/** Pale surface and subdued outline colors must never be used as label ink. */
export function readableLabelColor<T extends string>(color: T): T | 'black' {
  return ['white', 'grey', 'light-grey'].includes(color) ? 'black' : color;
}
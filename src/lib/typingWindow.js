export const DEFAULT_WINDOW_RADIUS = 900;

function findBoundary(text, index, direction) {
  if (direction < 0) {
    const space = Math.max(text.lastIndexOf(" ", index), text.lastIndexOf("\n", index));
    return space < 0 ? 0 : space + 1;
  }
  const candidates = [text.indexOf(" ", index), text.indexOf("\n", index)].filter((value) => value >= 0);
  return candidates.length ? Math.min(...candidates) + 1 : text.length;
}

export function getTypingWindow(target = "", currentIndex = 0, radius = DEFAULT_WINDOW_RADIUS) {
  const safeIndex = Math.max(0, Math.min(target.length, Number(currentIndex) || 0));
  if (target.length <= radius * 2) return { start: 0, end: target.length, text: target, hiddenBefore: 0, hiddenAfter: 0 };
  const start = findBoundary(target, Math.max(0, safeIndex - radius), -1);
  const end = findBoundary(target, Math.min(target.length, safeIndex + radius), 1);
  return { start, end, text: target.slice(start, end), hiddenBefore: start, hiddenAfter: Math.max(0, target.length - end) };
}

export function getActiveWordRange(target = "", currentIndex = 0) {
  const safeIndex = Math.max(0, Math.min(target.length, Number(currentIndex) || 0));
  const start = Math.max(target.lastIndexOf(" ", Math.max(0, safeIndex - 1)), target.lastIndexOf("\n", Math.max(0, safeIndex - 1))) + 1;
  const candidates = [target.indexOf(" ", safeIndex), target.indexOf("\n", safeIndex)].filter((value) => value >= 0);
  return { start, end: candidates.length ? Math.min(...candidates) : target.length };
}

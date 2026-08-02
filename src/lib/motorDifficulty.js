const KEYBOARD = {
  q: { hand: "left", finger: "pinky", row: 0, column: 0 },
  w: { hand: "left", finger: "ring", row: 0, column: 1 },
  e: { hand: "left", finger: "middle", row: 0, column: 2 },
  r: { hand: "left", finger: "index", row: 0, column: 3 },
  t: { hand: "left", finger: "index", row: 0, column: 4 },
  y: { hand: "right", finger: "index", row: 0, column: 5 },
  u: { hand: "right", finger: "index", row: 0, column: 6 },
  i: { hand: "right", finger: "middle", row: 0, column: 7 },
  o: { hand: "right", finger: "ring", row: 0, column: 8 },
  p: { hand: "right", finger: "pinky", row: 0, column: 9 },
  a: { hand: "left", finger: "pinky", row: 1, column: 0.25 },
  s: { hand: "left", finger: "ring", row: 1, column: 1.25 },
  d: { hand: "left", finger: "middle", row: 1, column: 2.25 },
  f: { hand: "left", finger: "index", row: 1, column: 3.25 },
  g: { hand: "left", finger: "index", row: 1, column: 4.25 },
  h: { hand: "right", finger: "index", row: 1, column: 5.25 },
  j: { hand: "right", finger: "index", row: 1, column: 6.25 },
  k: { hand: "right", finger: "middle", row: 1, column: 7.25 },
  l: { hand: "right", finger: "ring", row: 1, column: 8.25 },
  z: { hand: "left", finger: "pinky", row: 2, column: 0.75 },
  x: { hand: "left", finger: "ring", row: 2, column: 1.75 },
  c: { hand: "left", finger: "middle", row: 2, column: 2.75 },
  v: { hand: "left", finger: "index", row: 2, column: 3.75 },
  b: { hand: "left", finger: "index", row: 2, column: 4.75 },
  n: { hand: "right", finger: "index", row: 2, column: 5.75 },
  m: { hand: "right", finger: "index", row: 2, column: 6.75 },
};

const COMMON_BIGRAMS = new Set([
  "th", "he", "in", "er", "an", "re", "on", "at", "en", "nd", "ti", "es", "or", "te", "of", "ed", "is", "it", "al", "ar", "st", "to", "nt", "ng", "se", "ha", "as", "ou", "io", "le", "ve", "co", "me", "de", "hi", "ri", "ro", "ic", "ne", "ea", "ra", "ce", "li", "ch", "ll", "be", "ma", "si", "om", "ur",
]);

const RARE_BIGRAMS = new Set([
  "jq", "qj", "qz", "zq", "qx", "xq", "qv", "vq", "qg", "gq", "qk", "kq", "qf", "fq", "qj", "zx", "xz", "zv", "vz", "jj", "ww", "yy", "pb", "bp", "dt", "td", "fg", "gf", "hu", "uh", "ju", "uj", "ki", "ik", "lo", "ol", "qa", "qe", "qi", "qo", "qy",
]);

const FINGER_STRENGTH = {
  pinky: 1.55,
  ring: 1.25,
  middle: 1.05,
  index: 0.85,
};

function lettersOnly(value) {
  return String(value || "").toLowerCase().match(/[a-z]/g) ?? [];
}

function pairKey(first, second) {
  return `${first}${second}`;
}

function ratio(value, total) {
  return total > 0 ? value / total : 0;
}

export function analyseMotorPattern(value) {
  const letters = lettersOnly(value);
  let sameFingerTransitions = 0;
  let handAlternations = 0;
  let sameHandTransitions = 0;
  let rowChanges = 0;
  let repeatedLetters = 0;
  let uncommonBigrams = 0;
  let lateralTravel = 0;
  let weakFingerLoad = 0;
  let leftCount = 0;
  let rightCount = 0;
  const bigrams = [];

  for (const letter of letters) {
    const key = KEYBOARD[letter];
    if (!key) continue;
    if (key.hand === "left") leftCount += 1;
    else rightCount += 1;
    weakFingerLoad += FINGER_STRENGTH[key.finger] ?? 1;
  }

  for (let index = 1; index < letters.length; index += 1) {
    const previousLetter = letters[index - 1];
    const currentLetter = letters[index];
    const previous = KEYBOARD[previousLetter];
    const current = KEYBOARD[currentLetter];
    if (!previous || !current) continue;
    const bigram = pairKey(previousLetter, currentLetter);
    bigrams.push(bigram);

    if (previousLetter === currentLetter) repeatedLetters += 1;
    if (previous.finger === current.finger && previous.hand === current.hand && previousLetter !== currentLetter) {
      sameFingerTransitions += 1;
    }
    if (previous.hand !== current.hand) handAlternations += 1;
    else sameHandTransitions += 1;
    if (previous.row !== current.row) rowChanges += 1;
    lateralTravel += Math.abs(previous.column - current.column);

    if (RARE_BIGRAMS.has(bigram) || (!COMMON_BIGRAMS.has(bigram) && /[qzxj]/.test(bigram))) {
      uncommonBigrams += 1;
    }
  }

  const transitions = Math.max(0, letters.length - 1);
  const typedLetters = Math.max(1, leftCount + rightCount);
  const dominantHandShare = Math.max(leftCount, rightCount) / typedLetters;

  return {
    letters: letters.length,
    transitions,
    sameFingerTransitions,
    sameFingerRatio: ratio(sameFingerTransitions, transitions),
    handAlternations,
    alternationRatio: ratio(handAlternations, transitions),
    sameHandTransitions,
    repeatedLetters,
    repeatedLetterRatio: ratio(repeatedLetters, transitions),
    rowChanges,
    rowChangeRatio: ratio(rowChanges, transitions),
    uncommonBigrams,
    uncommonBigramRatio: ratio(uncommonBigrams, transitions),
    averageTravel: ratio(lateralTravel, transitions),
    weakFingerLoad: ratio(weakFingerLoad, letters.length),
    leftCount,
    rightCount,
    dominantHandShare,
    bigrams,
  };
}

export function createFrequencyIndex(words = []) {
  const index = new Map();
  words.forEach((word, position) => {
    const clean = String(word || "").trim().toLowerCase();
    if (clean && !index.has(clean)) index.set(clean, position);
  });
  return index;
}

export function getFrequencyTier(word, frequencyIndex, totalWords = frequencyIndex?.size ?? 0) {
  const clean = String(word || "").trim().toLowerCase();
  const rank = frequencyIndex?.get(clean);
  if (rank == null) return 4;
  const total = Math.max(1, totalWords);
  const percentile = rank / total;
  if (rank < 250 || percentile <= 0.18) return 1;
  if (rank < 700 || percentile <= 0.5) return 2;
  if (rank < 1250 || percentile <= 0.82) return 3;
  return 4;
}

export function scoreMotorDifficulty(value, options = {}) {
  const clean = String(value || "").trim();
  const motor = analyseMotorPattern(clean);
  const words = clean.toLowerCase().match(/[a-z'-]+/g) ?? [];
  const frequencyIndex = options.frequencyIndex;
  const totalWords = options.totalWords ?? frequencyIndex?.size ?? 0;
  const frequencyTiers = words.map((word) => getFrequencyTier(word, frequencyIndex, totalWords));
  const averageFrequencyTier = frequencyTiers.length
    ? frequencyTiers.reduce((sum, tier) => sum + tier, 0) / frequencyTiers.length
    : 4;
  const longestWord = words.reduce((maximum, word) => Math.max(maximum, word.length), 0);
  const averageWordLength = words.length
    ? words.reduce((sum, word) => sum + word.length, 0) / words.length
    : 0;
  const capitalCount = (clean.match(/[A-Z]/g) ?? []).length;
  const punctuationCount = (clean.match(/[.,;:!?()'"-]/g) ?? []).length;
  const numberCount = (clean.match(/[0-9]/g) ?? []).length;
  const symbolCount = (clean.match(/[@#$%&/+=_]/g) ?? []).length;

  const score = Math.max(0,
    ((averageFrequencyTier - 1) * 7)
    + Math.max(0, averageWordLength - 4.5) * 2.1
    + Math.max(0, longestWord - 9) * 1.15
    + motor.sameFingerTransitions * 3.6
    + motor.repeatedLetters * 1.8
    + motor.uncommonBigrams * 4.4
    + motor.rowChanges * 0.42
    + Math.max(0, motor.dominantHandShare - 0.68) * 18
    + Math.max(0, 0.38 - motor.alternationRatio) * 10
    + capitalCount * 0.65
    + punctuationCount * 0.55
    + numberCount * 0.7
    + symbolCount * 1.3,
  );

  return {
    score,
    band: score < 18 ? "easy" : score < 34 ? "balanced" : score < 52 ? "challenging" : "advanced",
    frequencyTier: Math.max(1, Math.min(4, Math.round(averageFrequencyTier))),
    averageFrequencyTier,
    averageWordLength,
    longestWord,
    capitalCount,
    punctuationCount,
    numberCount,
    symbolCount,
    ...motor,
  };
}

const BAND_TARGETS = {
  easy: { minimum: 0, maximum: 24, ideal: 13, tiers: [1, 2] },
  balanced: { minimum: 12, maximum: 42, ideal: 27, tiers: [1, 2, 3] },
  hard: { minimum: 27, maximum: 80, ideal: 45, tiers: [2, 3, 4] },
  adaptive: { minimum: 12, maximum: 56, ideal: 31, tiers: [1, 2, 3, 4] },
};

export function resolveDifficultyBand(difficulty = "balanced", skillStage = "developing") {
  if (difficulty !== "adaptive") return BAND_TARGETS[difficulty] ?? BAND_TARGETS.balanced;
  if (skillStage === "foundation") return { ...BAND_TARGETS.easy, label: "foundation" };
  if (skillStage === "developing") return { ...BAND_TARGETS.balanced, label: "developing" };
  if (skillStage === "functional") return { minimum: 20, maximum: 52, ideal: 35, tiers: [1, 2, 3, 4], label: "functional" };
  return { ...BAND_TARGETS.hard, label: "advanced" };
}

export function difficultyWeight(profile, target) {
  if (!profile || !target) return 1;
  const distance = Math.abs(profile.score - target.ideal);
  const insideBand = profile.score >= target.minimum && profile.score <= target.maximum;
  const tierMatch = target.tiers.includes(profile.frequencyTier);
  const base = insideBand ? 2.8 : Math.max(0.2, 1.5 - (distance / 18));
  return base * (tierMatch ? 1.35 : 0.72);
}

export function resolveFeatureProgression(recipe = {}) {
  const explicit = {
    punctuation: Boolean(recipe.punctuation),
    capitals: Boolean(recipe.capitals),
    numbers: Boolean(recipe.numbers),
  };
  if (!recipe.progressiveFeatures) {
    return {
      mode: "manual",
      punctuationRate: explicit.punctuation ? 0.1 : 0,
      capitalRate: explicit.capitals ? 0.08 : 0,
      numberRate: explicit.numbers ? 0.045 : 0,
      symbols: false,
    };
  }

  const stage = recipe.skillStage || "developing";
  const stageRates = {
    foundation: { punctuationRate: 0.025, capitalRate: 0.015, numberRate: 0 },
    developing: { punctuationRate: 0.065, capitalRate: 0.04, numberRate: 0.012 },
    functional: { punctuationRate: 0.11, capitalRate: 0.075, numberRate: 0.03 },
    advanced: { punctuationRate: 0.16, capitalRate: 0.11, numberRate: 0.055 },
  }[stage] ?? { punctuationRate: 0.065, capitalRate: 0.04, numberRate: 0.012 };

  const hardMultiplier = recipe.difficulty === "hard" ? 1.3 : recipe.difficulty === "easy" ? 0.65 : 1;
  return {
    mode: "progressive",
    punctuationRate: explicit.punctuation ? Math.max(0.1, stageRates.punctuationRate) : stageRates.punctuationRate * hardMultiplier,
    capitalRate: explicit.capitals ? Math.max(0.08, stageRates.capitalRate) : stageRates.capitalRate * hardMultiplier,
    numberRate: explicit.numbers ? Math.max(0.045, stageRates.numberRate) : stageRates.numberRate * hardMultiplier,
    symbols: stage === "advanced" && recipe.difficulty === "hard",
  };
}

export function summariseMotorDifficulty(items = [], options = {}) {
  const profiles = items
    .map((item) => scoreMotorDifficulty(item, options))
    .filter((item) => item.letters > 0);
  if (!profiles.length) {
    return {
      averageScore: 0,
      band: "easy",
      frequencyTiers: { 1: 0, 2: 0, 3: 0, 4: 0 },
      sameFingerRatio: 0,
      alternationRatio: 0,
      repeatedLetterRatio: 0,
      uncommonBigramRatio: 0,
      averageTravel: 0,
    };
  }
  const average = (key) => profiles.reduce((sum, profile) => sum + (Number(profile[key]) || 0), 0) / profiles.length;
  const averageScore = average("score");
  const frequencyTiers = { 1: 0, 2: 0, 3: 0, 4: 0 };
  profiles.forEach((profile) => { frequencyTiers[profile.frequencyTier] += 1; });
  return {
    averageScore,
    band: averageScore < 18 ? "easy" : averageScore < 34 ? "balanced" : averageScore < 52 ? "challenging" : "advanced",
    frequencyTiers,
    sameFingerRatio: average("sameFingerRatio"),
    alternationRatio: average("alternationRatio"),
    repeatedLetterRatio: average("repeatedLetterRatio"),
    uncommonBigramRatio: average("uncommonBigramRatio"),
    averageTravel: average("averageTravel"),
    dominantHandShare: average("dominantHandShare"),
  };
}

export function getKeyboardMotorMap() {
  return KEYBOARD;
}

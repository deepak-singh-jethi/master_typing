import {
  commonWords,
  practiceParagraphs,
  practicalSentences,
  quotes,
  generateNumberText,
} from "./wordBank.js";
import {
  CURRICULUM_VERSION,
  GUIDED_CONTENT_VERSION,
  getLessonById,
  getLessonsByModule,
} from "./curriculum.js";
import { generateNaturalSentenceBank, generatePracticalDocumentBank, getNaturalContentStats } from "./naturalContent.js";
import {
  createFrequencyIndex,
  difficultyWeight,
  resolveDifficultyBand,
  resolveFeatureProgression,
  scoreMotorDifficulty,
  summariseMotorDifficulty,
} from "../lib/motorDifficulty.js";

const studyWords = `
answer article assessment chapter class concept course definition education exam example explanation fact focus geography history idea important information language learn lesson note practice prepare question read reason reference research result review revision school score section student study subject summary syllabus teacher test theory topic understand write
`.trim().split(/\s+/);

const workWords = `
account action address agenda approval attachment budget client comment company contact customer data deadline decision delivery department document draft email employee feedback file form invoice meeting message office order payment plan project receipt report request response review schedule service status submit support task team update work
`.trim().split(/\s+/);

const technologyWords = `
application backup browser button cloud code computer dashboard data database device digital download error file filter folder frontend hardware input install interface internet keyboard login mobile network offline password platform profile program project screen search server settings software storage system update upload user version website window
`.trim().split(/\s+/);

const governmentWords = `
application authority certificate citizen commission committee department district document election form government identification law ministry notification office policy public record reference registration report rule service state submission verification
`.trim().split(/\s+/);

const frequencyIndex = createFrequencyIndex(commonWords);
const PRACTICE_YEAR = new Date().getFullYear();

const highFrequencyWords = `
the of and to in is you that it he was for on are as with his they I at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part
`.trim().split(/\s+/);

const sentenceBanks = {
  general: practicalSentences,
  study: [
    "Review the main idea before memorising the supporting facts.",
    "The chapter should be revised again after the practice test.",
    "Write a short explanation for every answer you get wrong.",
    "A good revision plan includes recall, practice, and correction.",
    "Read the complete question before selecting the final option.",
    "The summary should contain dates, causes, events, and results.",
    "Use verified sources when a fact is important for the exam.",
    "Regular testing reveals which topics need another revision cycle.",
  ],
  work: [
    "Please review the attached report before tomorrow's meeting.",
    "The updated invoice includes the correct address and payment date.",
    "Send a short progress update before the end of the working day.",
    "The team will discuss the pending decisions on Friday morning.",
    "Check every field before submitting the online application form.",
    "The customer requested a copy of the receipt by email.",
    "Add the final comments to the document and save a backup copy.",
    "The project schedule lists the owner and deadline for every task.",
  ],
  technology: [
    "The application stores progress locally in the browser.",
    "Restart the development server after changing the configuration.",
    "A clear error message should explain what the user can do next.",
    "The responsive layout must work on both mobile and desktop screens.",
    "Save important files before installing a major software update.",
    "The dashboard displays recent activity and current performance.",
    "Use a strong password and keep a secure backup of your data.",
    "The typing engine records accuracy, speed, and difficult keys.",
  ],
  government: [
    "The application form requires a valid reference number and date.",
    "Read the official notification before submitting the document.",
    "The department published the revised schedule on its website.",
    "Every certificate should be checked before final verification.",
    "The committee submitted its report to the state government.",
    "Public records must contain accurate names, dates, and addresses.",
    "The candidate should keep a copy of the completed registration form.",
    "The notification explains eligibility, fees, and important deadlines.",
  ],
};

const paragraphBanks = {
  general: practiceParagraphs,
  study: [
    "A strong study session begins with a clear target. The learner should recall the topic before opening the notes, answer a few questions from memory, and then correct the missing points. This method turns revision into active practice instead of passive reading.",
    "Exam preparation improves when mistakes are recorded and reviewed. A wrong answer should lead to a short note explaining the correct fact, the reason for confusion, and the clue that will prevent the same error next time.",
    "A useful chapter summary contains the central idea, important facts, common traps, and a small set of questions. It should remain easy to scan so that repeated revision is possible before the examination.",
  ],
  work: [
    "The weekly project report should explain what was completed, what remains pending, which risks require attention, and who owns the next action. Short headings and accurate dates make the report easier to review during a meeting.",
    "Before submitting an online form, compare every name, date, amount, and identification number with the source document. A final review takes little time and can prevent errors that are difficult to correct later.",
    "A professional email states the purpose early, includes only the necessary details, and ends with a clear request or deadline. The subject line should help the recipient understand the message before opening it.",
  ],
  technology: [
    "A reliable web application should remain understandable when something goes wrong. Buttons need clear labels, forms should preserve useful input, and error messages should explain the next step instead of only reporting failure.",
    "Local storage is useful for a browser-only product because it can preserve settings and progress without a server. The application should still provide export, import, and reset controls so the learner remains in control of the data.",
    "A typing interface must respond immediately to each key while avoiding unnecessary visual movement. The text should remain readable, the active character should stay visible, and performance metrics should not distract the learner from the exercise.",
  ],
  government: [
    "An official notification normally explains the number of posts, eligibility conditions, application dates, fees, selection process, and important instructions. Candidates should rely on the published document rather than an unverified summary.",
    "Public administration depends on accurate records. Names, dates, addresses, reference numbers, and decisions should be entered carefully because a small typing error can affect later verification and communication.",
    "A committee report usually describes the issue examined, the evidence considered, the findings reached, and the recommendations proposed. A concise summary should preserve these distinctions.",
  ],
};

const emailAndFormTexts = [
  "Subject: Project Update. Please review the attached draft and reply by Friday afternoon.",
  `Email: learner@example.com. Reference: TM-2048. Date: 31/07/${PRACTICE_YEAR}.`,
  "Please confirm that the application was received and list any missing documents.",
  `Name: Sample Candidate. Contact: 9000000000. Application ID: UK-${PRACTICE_YEAR}-1842.`,
  "To: support@example.com. Subject: Payment receipt request. Please send a copy of receipt 1250.",
  "Meeting: Monday, 4:30 PM. Agenda: progress review, pending work, and next actions.",
  "Address: 24 Hill View Road, Dehradun. Postal code: 248001. State: Uttarakhand.",
  "The revised invoice is attached. Check the amount, due date, customer name, and reference number.",
  "Please update the contact email from old@example.com to new@example.com before submission.",
  "Registration number: TM-4508. Username: learner_26. Status: verification pending.",
  "Dear Team, the final report is ready for review. Please add comments before 5:00 PM.",
  "Document name: monthly-report.pdf. Version: 3.2. Owner: Project Team.",
  "The form requires a full name, date of birth, mobile number, email address, and signature.",
  `Subject: Leave Request. I request leave from 12/08/${PRACTICE_YEAR} to 14/08/${PRACTICE_YEAR}.`,
  "Please verify the uploaded certificate and confirm whether the file is clear and complete.",
  "Ticket ID: SUP-9081. Issue: login error. Priority: normal. Status: open.",
  "Forward learner@example.com to help-desk@example.com, archive-team@example.com, and records@example.com under case TM-2054.",
  "Send form-21 to records@example.com, form-22 to review@example.com, form-23 to audit@example.com, and form-24 to admin@example.com.",
  "Confirm that user-one@example.com, user-two@example.com, and user-three@example.com match records TM-301 and TM-302.",
  "Use report-01.pdf for team@example.com, report-02.pdf for manager@example.com, and report-03.pdf for audit@example.com before ticket TM-903.",
];

const assessmentTexts = [
  "Good typing is a controlled skill built through correct movement, careful practice, and steady repetition. A reliable typist keeps the eyes on the screen, the shoulders relaxed, and the fingers close to their home positions.",
  `Please prepare the final report by 4:30 PM on Friday, 31 July ${PRACTICE_YEAR}. Check every figure, heading, email address, and reference number before you submit the document.`,
  "A skilled typist reads ahead, maintains a sustainable rhythm, and corrects errors without panic. Speed becomes useful only when accuracy remains stable across words, sentences, numbers, and practical documents.",
  "The application form includes personal details, qualification records, dates, and document references. Enter each field carefully because one incorrect character can delay later verification.",
  "Progress should be compared through consistent tests. Use the same duration and rules, complete the full timer, and treat an interrupted result as practice rather than a personal record.",
  "A focused practice plan combines technique, correction, useful text, and periodic testing. The learner should know why each session exists and what improvement would count as success.",
];

const categoryPools = {
  general: commonWords,
  study: [...studyWords, ...highFrequencyWords],
  work: [...workWords, ...highFrequencyWords],
  technology: [...technologyWords, ...highFrequencyWords],
  government: [...governmentWords, ...highFrequencyWords],
};

function seededRandom(seed = Date.now()) {
  let state = Math.abs(Number(seed) || 1) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normaliseItem(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function countWords(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function applyDifficulty(pool, difficulty, skillStage = "developing") {
  const target = resolveDifficultyBand(difficulty, skillStage);
  const scored = pool.map((word) => ({
    word,
    profile: scoreMotorDifficulty(word, { frequencyIndex, totalWords: commonWords.length }),
  }));
  const inside = scored.filter(({ profile }) => profile.score >= target.minimum && profile.score <= target.maximum);
  return (inside.length >= Math.min(80, Math.ceil(pool.length * 0.18)) ? inside : scored)
    .sort((a, b) => Math.abs(a.profile.score - target.ideal) - Math.abs(b.profile.score - target.ideal))
    .map((item) => item.word);
}

function decorateWord(word, index, options, random) {
  let output = word;
  const policy = options.featurePolicy ?? {
    punctuationRate: options.punctuation ? 0.1 : 0,
    capitalRate: options.capitals ? 0.08 : 0,
    numberRate: options.numbers ? 0.045 : 0,
  };
  if (policy.capitalRate > 0 && (random() < policy.capitalRate || (index > 0 && index % Math.max(7, Math.round(1 / policy.capitalRate)) === 0))) {
    output = output.charAt(0).toUpperCase() + output.slice(1);
  }
  if (policy.numberRate > 0 && index > 0 && random() < policy.numberRate) {
    const number = 10 + Math.floor(random() * 9890);
    output = `${output} ${policy.symbols && index % 3 === 0 ? "#" : ""}${number}`;
  }
  if (policy.punctuationRate > 0 && index > 0 && random() < policy.punctuationRate) {
    const punctuation = [",", ".", ";", ":"][Math.floor(random() * (policy.symbols ? 4 : 2))];
    output = `${output}${punctuation}`;
  }
  return output;
}

function getFocusPatterns(recipe = {}) {
  const keys = (recipe.focusKeys ?? []).map((item) => String(item).toLowerCase()).filter((item) => item.length === 1);
  const bigrams = unique([
    ...(recipe.focusBigrams ?? []),
    ...(recipe.focusPatterns ?? []),
  ].map((item) => String(item).toLowerCase()).filter((item) => item.length >= 2));
  const confusionKeys = (recipe.confusionPairs ?? [])
    .flatMap((item) => [item.expected, item.actual])
    .map((item) => String(item || "").toLowerCase())
    .filter((item) => item.length === 1);
  const recoveryWords = (recipe.recoveryWords ?? []).map(normaliseItem).filter(Boolean);
  return { keys: unique(keys), bigrams: unique(bigrams), confusionKeys: unique(confusionKeys), recoveryWords: unique(recoveryWords) };
}

function focusScore(value, recipe = {}) {
  const text = normaliseItem(value);
  const patterns = getFocusPatterns(recipe);
  let score = 0;
  if (patterns.recoveryWords.includes(text)) score += 24;
  for (const word of patterns.recoveryWords) {
    if (word && text.includes(word)) score += 7;
  }
  for (const bigram of patterns.bigrams) {
    if (bigram && text.includes(bigram)) score += 10;
  }
  for (const key of patterns.keys) {
    if (text.includes(key)) score += 2.5;
  }
  for (const key of patterns.confusionKeys) {
    if (text.includes(key)) score += 1.5;
  }
  return score;
}

function weightedPick(candidates, random, previous = "") {
  if (!candidates.length) return null;
  const usable = candidates.length > 1
    ? candidates.filter((item) => item.value !== previous)
    : candidates;
  const source = usable.length ? usable : candidates;
  const total = source.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * total;
  for (const item of source) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return source[source.length - 1].value;
}

function buildRecipeWords(pool, count, recipe, seed) {
  const random = seededRandom(seed);
  const recent = new Set((recipe.recentExclusions?.items ?? []).map(normaliseItem));
  const recoveryWords = unique((recipe.recoveryWords ?? [])
    .map(normaliseItem)
    .filter((word) => /^[a-z'-]{2,30}$/i.test(word)));
  const supplementalFocusWords = ["adaptive", "recovery"].includes(recipe.purpose)
    ? commonWords.filter((word) => focusScore(word, recipe) > 0)
    : [];
  const cleanPool = unique([...pool, ...supplementalFocusWords, ...recoveryWords]
    .map((word) => String(word).trim().toLowerCase())
    .filter(Boolean));
  const preferredPool = cleanPool.filter((word) => !recent.has(normaliseItem(word)));
  const sourcePool = preferredPool.length >= Math.min(40, cleanPool.length / 3) ? preferredPool : cleanPool;
  const difficultyTarget = recipe.difficultyTarget ?? resolveDifficultyBand(recipe.difficulty, recipe.skillStage);
  const candidates = sourcePool.map((value) => {
    const focus = focusScore(value, recipe);
    const profile = scoreMotorDifficulty(value, { frequencyIndex, totalWords: commonWords.length });
    return {
      value,
      focus,
      profile,
      weight: Math.max(0.05, (1 + focus) * difficultyWeight(profile, difficultyTarget)),
    };
  });
  const focused = candidates.filter((item) => item.focus > 0);
  const neutral = candidates.filter((item) => item.focus <= 0);
  const output = [];
  const used = new Set();
  const recoveryQueue = [];
  const recoveryRepeats = recoveryWords.length
    ? Math.min(3, Math.max(1, Math.floor(count / Math.max(20, recoveryWords.length * 8))))
    : 0;
  for (let repeat = 0; repeat < recoveryRepeats; repeat += 1) recoveryQueue.push(...recoveryWords);
  const desiredFocused = Math.min(count, Math.round(count * (Number(recipe.targetDensity) || 0)));
  let focusedCount = 0;
  let previous = "";

  const chooseUnused = (basePool) => {
    const unused = basePool.filter((item) => !used.has(item.value));
    if (!unused.length) used.clear();
    const source = unused.length ? unused : basePool;
    return weightedPick(source, random, previous);
  };

  for (let index = 0; index < count; index += 1) {
    const remaining = count - index;
    const focusedStillNeeded = Math.max(0, desiredFocused - focusedCount);
    let word = null;

    if (recoveryQueue.length && (index % 5 === 1 || remaining <= recoveryQueue.length)) {
      const queueIndex = Math.floor(random() * recoveryQueue.length);
      word = recoveryQueue.splice(queueIndex, 1)[0];
      if (word === previous && recoveryQueue.length) word = recoveryQueue.shift();
    } else if (focused.length && (focusedStillNeeded >= remaining || random() < (focusedStillNeeded / Math.max(1, remaining)))) {
      word = chooseUnused(focused);
    } else {
      word = chooseUnused(neutral.length ? neutral : candidates);
    }

    if (!word) word = "practice";
    if (word === previous && candidates.length > 1) {
      const alternatives = candidates.filter((item) => item.value !== previous);
      word = weightedPick(alternatives, random, previous) || word;
    }
    if (focusScore(word, recipe) > 0) focusedCount += 1;
    output.push(word);
    used.add(word);
    previous = word;
  }

  return output;
}

function buildTextSequence(bank, minimumWords, recipe, seed, minimumItems = 0) {
  const random = seededRandom(seed);
  const recent = new Set((recipe.recentExclusions?.items ?? []).map(normaliseItem));
  const uniqueBank = [...new Map(
    bank.filter(Boolean).map((item) => [normaliseItem(item), item]),
  ).values()];
  const fresh = uniqueBank.filter((item) => !recent.has(normaliseItem(item)));
  const source = fresh.length >= Math.min(12, uniqueBank.length / 3) ? fresh : uniqueBank;
  const difficultyTarget = recipe.difficultyTarget ?? resolveDifficultyBand(recipe.difficulty, recipe.skillStage);
  const candidates = source.map((value) => {
    const focus = focusScore(value, recipe);
    const profile = scoreMotorDifficulty(value, { frequencyIndex, totalWords: commonWords.length });
    return {
      value,
      focus,
      profile,
      weight: Math.max(0.05, (1 + focus) * difficultyWeight(profile, difficultyTarget)),
    };
  });
  const focused = candidates.filter((item) => item.focus > 0);
  const neutral = candidates.filter((item) => item.focus <= 0);
  const output = [];
  const used = new Set();
  let words = 0;
  let previous = "";

  const append = (value) => {
    output.push(value);
    words += countWords(value);
    previous = value;
    used.add(normaliseItem(value));
  };

  const coverageRequirements = Array.isArray(recipe.coverageRequirements)
    ? recipe.coverageRequirements
    : [];
  const coverageCounts = Object.fromEntries(
    coverageRequirements.map((item) => [item.target, 0]),
  );
  const updateCoverage = (value) => {
    coverageRequirements.forEach((item) => {
      coverageCounts[item.target] += countLessonTargetOccurrences(value, item.target);
    });
  };

  let coverageGuard = 0;
  while (coverageRequirements.some((item) => coverageCounts[item.target] < item.minimum)
    && coverageGuard < Math.max(40, coverageRequirements.length * 30)) {
    coverageGuard += 1;
    const requirement = coverageRequirements
      .filter((item) => coverageCounts[item.target] < item.minimum)
      .sort((first, second) => (
        (coverageCounts[first.target] / Math.max(1, first.minimum))
        - (coverageCounts[second.target] / Math.max(1, second.minimum))
      ))[0];
    let pool = candidates.filter((item) => countLessonTargetOccurrences(item.value, requirement.target) > 0);
    const unused = pool.filter((item) => !used.has(normaliseItem(item.value)));
    if (unused.length) pool = unused;
    const withoutRepeat = pool.filter((item) => normaliseItem(item.value) !== normaliseItem(previous));
    if (withoutRepeat.length) pool = withoutRepeat;
    const value = weightedPick(pool, random, previous);
    if (!value) break;
    append(value);
    updateCoverage(value);
  }

  while ((words < minimumWords || output.length < minimumItems) && candidates.length > 0) {
    const needFocus = focused.length && random() < (Number(recipe.targetDensity) || 0);
    let pool = needFocus ? focused : (neutral.length ? neutral : candidates);
    const unused = pool.filter((item) => !used.has(normaliseItem(item.value)));
    if (unused.length) pool = unused;
    else used.clear();
    if (pool.length === 1
      && candidates.length > 1
      && normaliseItem(pool[0].value) === normaliseItem(previous)) {
      const unusedAlternatives = candidates.filter((item) => (
        normaliseItem(item.value) !== normaliseItem(previous)
        && !used.has(normaliseItem(item.value))
      ));
      pool = unusedAlternatives.length
        ? unusedAlternatives
        : candidates.filter((item) => normaliseItem(item.value) !== normaliseItem(previous));
    }
    const value = weightedPick(pool, random, previous);
    if (!value) break;
    append(value);
    updateCoverage(value);
  }

  return { text: output.join(" "), items: output };
}


function getLiteralLessonFocus(lesson) {
  return lesson.focusKeys
    .map((key) => key === "Space" ? " " : String(key))
    .filter((key) => key.length === 1);
}

function countLessonTargetOccurrences(text, target) {
  const value = String(text || "");
  if (target === "Shift") return (value.match(/[A-Z]/g) ?? []).length;
  const pattern = String(target || "").toLowerCase();
  if (!pattern || target === "Space") return 0;
  return countOccurrences(value.toLowerCase(), pattern);
}

function lessonTargetAppearsInSeed(target, seedText) {
  if (target === "Shift") return /[A-Z]/.test(seedText);
  if (target === "Space") return false;
  return String(seedText || "").toLowerCase().includes(String(target).toLowerCase());
}

export function getLessonCoverageRequirements({ lesson, exercise = null, targetWords = exercise?.targetWords } = {}) {
  if (!lesson) return [];
  const declaredTargets = exercise?.cumulativeReview && exercise.reviewTargets?.length
    ? exercise.reviewTargets
    : lesson.coverageTargets ?? lesson.focusKeys ?? [];
  const sourceTargets = unique(declaredTargets.map(String))
    .filter((target) => target && target !== "Space");
  const targets = exercise && !exercise.cumulativeReview
    ? sourceTargets.filter((target) => lessonTargetAppearsInSeed(target, exercise.target))
    : sourceTargets;
  const words = Math.max(10, Number(targetWords) || 10);

  return targets.map((target) => {
    const isSymbol = target.length === 1 && !/[a-z0-9]/i.test(target);
    const rate = target === "Shift"
      ? 0.1
      : isSymbol
        ? 0.05
        : target.length > 1
          ? 0.06
          : targets.length <= 2
            ? 0.1
            : targets.length <= 10
              ? 0.05
              : 0.03;
    const base = target === "Shift" ? 4 : target.length > 1 ? 3 : /[a-z0-9]/i.test(target) ? 4 : 3;
    return {
      target,
      minimum: Math.max(base, Math.ceil(words * rate)),
    };
  });
}

function tokenMatchesLessonTarget(token, target) {
  return countLessonTargetOccurrences(token, target) > 0;
}

const compatibleLessonWordCache = new Map();

function getCompatibleLessonWords(lesson) {
  if (compatibleLessonWordCache.has(lesson.id)) return compatibleLessonWordCache.get(lesson.id);
  const targets = unique((lesson.coverageTargets ?? lesson.focusKeys ?? []).map(String))
    .filter((target) => target !== "Space");
  const words = commonWords
    .map((word) => String(word).trim())
    .filter((word) => word.length > 1 && [...word].every((character) => lesson.allowedCharacters.includes(character)))
    .filter((word) => !targets.length || targets.some((target) => tokenMatchesLessonTarget(word, target)));
  const result = unique(words);
  compatibleLessonWordCache.set(lesson.id, result);
  return result;
}

function getGuidedCandidateTokens(lesson, exercise = null) {
  const sourceLessons = exercise?.cumulativeReview
    ? getLessonsByModule(lesson.moduleId).filter((item) => item.number <= lesson.number)
    : [lesson];
  const sourceExercises = exercise?.cumulativeReview
    ? sourceLessons.flatMap((item) => item.exercises)
    : exercise ? [exercise] : lesson.exercises;
  const guidedTokens = sourceExercises
    .flatMap((item) => sanitizeForLesson(item.target, lesson).split(/\s+/))
    .filter(Boolean);
  const practiceTokens = sourceLessons.flatMap((item) => item.practiceTokens)
    .map((token) => sanitizeForLesson(token, lesson))
    .filter(Boolean);
  const compatibleWords = getCompatibleLessonWords(lesson);
  const sourceTokens = exercise
    ? [...guidedTokens, ...practiceTokens, ...compatibleWords]
    : lesson.coverageBalance
      ? [...guidedTokens, ...practiceTokens, ...compatibleWords]
      : [...practiceTokens, ...compatibleWords];
  let validTokens = unique(sourceTokens)
    .filter((token) => [...token].every((char) => lesson.allowedCharacters.includes(char)));

  if (exercise?.shiftHand) {
    const supportedCapitals = exercise.shiftHand === "left"
      ? new Set(["Y", "U", "I", "O", "P", "H", "J", "K", "L", "N", "M"])
      : new Set(["Q", "W", "E", "R", "T", "A", "S", "D", "F", "G", "Z", "X", "C", "V", "B"]);
    validTokens = validTokens.filter((token) => {
      const capitals = token.match(/[A-Z]/g) ?? [];
      return capitals.length === 0 || capitals.every((capital) => supportedCapitals.has(capital));
    });
  }

  if (!exercise || exercise.stage !== "focus") return validTokens;
  const literalFocus = getLiteralLessonFocus(lesson).filter((key) => key !== " ");
  const patternFocus = lesson.focusKeys.map(String).filter((key) => key.length > 1 && !["Space", "Shift"].includes(key));
  const focused = validTokens.filter((token) => (
    literalFocus.some((key) => token.toLowerCase().includes(key.toLowerCase()))
    || patternFocus.some((pattern) => token.toLowerCase().includes(pattern.toLowerCase()))
  ));
  return focused.length >= 5 ? unique([...guidedTokens, ...focused]) : validTokens;
}

function buildBalancedLessonText(lesson, count, seed, exercise = null) {
  const random = seededRandom(seed);
  const candidates = getGuidedCandidateTokens(lesson, exercise);
  if (!candidates.length) return generateLessonPatterns(lesson, count, seed);

  const requirements = getLessonCoverageRequirements({ lesson, exercise, targetWords: count });
  const counts = Object.fromEntries(requirements.map((item) => [item.target, 0]));
  const candidateCoverage = new Map(candidates.map((candidate) => [
    candidate,
    Object.fromEntries(requirements.map((item) => [
      item.target,
      countLessonTargetOccurrences(candidate, item.target),
    ])),
  ]));
  const candidatesByTarget = Object.fromEntries(requirements.map((item) => [
    item.target,
    candidates
      .filter((candidate) => candidateCoverage.get(candidate)[item.target] > 0)
      .slice(0, 96),
  ]));
  const balanceTargets = (!exercise || exercise.cumulativeReview)
    && requirements.length > 1
    && Boolean(
      requirements.length === 2
      || lesson.moduleCheckpoint
      || lesson.coverageBalance
      || lesson.coverageTargets?.length
      || exercise?.reviewTargets?.length
    );
  const output = [];
  let unused = new Set(candidates);
  let previous = "";

  const transferAnchor = exercise?.stage === "transfer" && lesson.number >= 4
    ? sanitizeForLesson(exercise.target, lesson).split(/\s+/).filter(Boolean)
    : [];
  if (transferAnchor.length >= 4 && transferAnchor.length < count) {
    output.push(...transferAnchor);
    transferAnchor.forEach((token) => {
      requirements.forEach((item) => {
        counts[item.target] += countLessonTargetOccurrences(token, item.target);
      });
      unused.delete(token);
    });
    previous = transferAnchor.at(-1) ?? "";
  }

  const pick = (pool) => {
    const safePool = pool.length ? pool : candidates;
    let available = safePool.filter((token) => unused.has(token));
    if (!available.length) {
      unused = new Set(candidates);
      available = safePool.filter((token) => unused.has(token));
    }
    const withoutRepeat = available.filter((token) => normaliseItem(token) !== normaliseItem(previous));
    const fallback = candidates.filter((token) => normaliseItem(token) !== normaliseItem(previous) && unused.has(token));
    const source = withoutRepeat.length ? withoutRepeat : fallback.length ? fallback : available;
    const selected = source[Math.floor(random() * source.length)] || candidates[0];
    unused.delete(selected);
    return selected;
  };

  const balancedMatches = (target) => {
    const matches = candidatesByTarget[target] ?? [];
    if (!balanceTargets || matches.length < 2) return matches;
    const lowestCount = Math.min(...requirements.map((item) => counts[item.target]));
    return matches
      .map((candidate) => ({
        candidate,
        score: requirements.reduce((score, item) => (
          score + candidateCoverage.get(candidate)[item.target]
            * Math.max(1, counts[item.target] - lowestCount + 1)
        ), 0),
      }))
      .sort((first, second) => first.score - second.score)
      .slice(0, Math.min(24, matches.length))
      .map((item) => item.candidate);
  };

  while (output.length < count) {
    const underused = requirements
      .filter((item) => counts[item.target] < item.minimum)
      .sort((first, second) => (
        (counts[first.target] / Math.max(1, first.minimum))
        - (counts[second.target] / Math.max(1, second.minimum))
      ));
    let token;
    if (underused.length) {
      const requirement = underused[Math.floor(random() * Math.min(underused.length, 3))];
      token = pick(balancedMatches(requirement.target));
    } else if (balanceTargets) {
      const leastUsed = [...requirements]
        .sort((first, second) => counts[first.target] - counts[second.target]);
      const requirement = leastUsed[Math.floor(random() * Math.min(leastUsed.length, 3))];
      token = pick(balancedMatches(requirement.target));
    } else {
      token = pick(candidates);
    }
    output.push(token);
    requirements.forEach((item) => {
      counts[item.target] += candidateCoverage.get(token)?.[item.target]
        ?? countLessonTargetOccurrences(token, item.target);
    });
    previous = token;
  }

  let coverageGuard = 0;
  while (requirements.some((item) => counts[item.target] < item.minimum)
    && coverageGuard < Math.max(20, requirements.length * 20)) {
    coverageGuard += 1;
    const requirement = requirements
      .filter((item) => counts[item.target] < item.minimum)
      .sort((first, second) => counts[first.target] - counts[second.target])[0];
    const matches = candidatesByTarget[requirement.target] ?? [];
    if (!matches.length) break;
    const token = pick(matches);
    output.push(token);
    requirements.forEach((item) => {
      counts[item.target] += candidateCoverage.get(token)?.[item.target]
        ?? countLessonTargetOccurrences(token, item.target);
    });
    previous = token;
  }

  return output.join(" ");
}

function generateLessonPatterns(lesson, count, seed) {
  const allowed = [...lesson.allowedCharacters].filter((char) => /[a-z]/i.test(char));
  const focus = lesson.focusKeys.filter((key) => key.length === 1 && /[a-z]/i.test(key));
  const pool = unique([...focus, ...allowed]);
  const random = seededRandom(seed);
  const tokens = [];

  for (let index = 0; index < count; index += 1) {
    const length = 2 + Math.floor(random() * 3);
    let token = "";
    for (let charIndex = 0; charIndex < length; charIndex += 1) {
      const source = charIndex === 0 && focus.length ? focus : pool;
      token += source[Math.floor(random() * source.length)] ?? "f";
    }
    tokens.push(token);
  }
  return tokens.join(" ");
}

function sanitizeForLesson(text, lesson) {
  const allowed = new Set([...lesson.allowedCharacters]);
  return String(text || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .split("")
    .map((character) => allowed.has(character) ? character : /\s/.test(character) ? " " : "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function getAdvancedLessonBank(lesson, exercise = null) {
  let bank = null;
  if (lesson.id === "practical-sentences") {
    if (exercise?.id === "study") bank = sentenceBanks.study;
    else if (exercise?.id === "work") bank = sentenceBanks.work;
    else if (exercise?.id === "form") bank = emailAndFormTexts;
    else bank = unique(Object.values(sentenceBanks).flat());
  } else if (lesson.id === "emails-forms") {
    if (exercise?.id === "email") bank = emailAndFormTexts.filter((item) => /subject:|dear |to:|attached|email/i.test(item));
    else if (exercise?.id === "contact") bank = emailAndFormTexts.filter((item) => /email:|contact:|address:|number:| id:|registration/i.test(item));
    else if (exercise?.id === "request") bank = emailAndFormTexts.filter((item) => /please|request|confirm|verify|requires|ticket id|application id/i.test(item));
    else bank = emailAndFormTexts;
  } else if (lesson.id === "endurance") {
    if (exercise?.id === "work") bank = paragraphBanks.work;
    else if (exercise?.id === "study") bank = paragraphBanks.study;
    else if (exercise?.id === "paragraph") bank = unique([...paragraphBanks.general, ...practiceParagraphs]);
    else bank = unique([...Object.values(paragraphBanks).flat(), ...practiceParagraphs]);
  } else if (lesson.id === "foundation-assessment") {
    bank = unique([...assessmentTexts, ...practiceParagraphs, ...quotes]);
  }
  return bank ? unique(bank) : null;
}

function getAdvancedLessonText(lesson, targetWords, seed, exercise = null) {
  let bank = getAdvancedLessonBank(lesson, exercise);
  if (!bank?.length) return "";
  if (["practical-sentences", "endurance", "foundation-assessment"].includes(lesson.id)) {
    const category = exercise?.id === "study" ? "study" : exercise?.id === "work" ? "work" : "general";
    const naturalSentences = generateNaturalSentenceBank(category, seed + 211, 90);
    if (lesson.id === "practical-sentences") {
      bank = unique([...bank, ...naturalSentences]);
    } else {
      const naturalParagraphs = [];
      for (let index = 0; index + 2 < naturalSentences.length; index += 3) {
        naturalParagraphs.push(`${naturalSentences[index]} ${naturalSentences[index + 1]} ${naturalSentences[index + 2]}`);
      }
      bank = unique([...bank, ...naturalParagraphs]);
    }
  }
  const coverageRequirements = getLessonCoverageRequirements({ lesson, exercise, targetWords })
    .map((requirement) => ({
      ...requirement,
      minimum: Math.ceil(
        requirement.minimum
        * Number(lesson.coveragePracticeMultipliers?.[requirement.target] ?? 1),
      ),
    }));
  const coverageTargets = coverageRequirements.map((item) => item.target);
  const focusKeys = coverageTargets.filter((key) => key.length === 1);
  const focusBigrams = coverageTargets.filter((key) => key.length === 2);
  const focusPatterns = coverageTargets.filter((key) => key.length > 2 && key !== "Shift");
  const guidedRecipe = {
    focusKeys,
    focusBigrams,
    focusPatterns,
    targetDensity: exercise ? 0.42 : 0,
    recentExclusions: { items: [] },
    coverageRequirements,
  };
  return sanitizeForLesson(buildTextSequence(bank, targetWords, guidedRecipe, seed).text, lesson);
}

function countOccurrences(text, pattern) {
  if (!pattern) return 0;
  return text.split(pattern).length - 1;
}

export function assessLessonPracticeContent({ lesson, exercise = null, text, targetWords } = {}) {
  const value = String(text || "");
  const words = value.trim().split(/\s+/).filter(Boolean);
  const requiredWords = Math.max(10, Number(targetWords) || 10);
  const issues = [];

  if (!lesson) issues.push("missing-context");
  if (words.length < requiredWords) issues.push("too-short");
  if (lesson && [...value].some((character) => !lesson.allowedCharacters.includes(character))) issues.push("disallowed-character");

  const coverage = getLessonCoverageRequirements({ lesson, exercise, targetWords: requiredWords })
    .map((requirement) => ({
      ...requirement,
      actual: countLessonTargetOccurrences(value, requirement.target),
    }));
  coverage.forEach((item) => {
    if (item.actual < item.minimum) issues.push(`focus:${item.target}`);
  });
  const requiresBalancedCoverage = (!exercise || exercise.cumulativeReview)
    && coverage.length > 1
    && Boolean(
      coverage.length === 2
      || lesson?.moduleCheckpoint
      || lesson?.coverageBalance
      || lesson?.coverageTargets?.length
      || exercise?.reviewTargets?.length
    );
  const lowestCoverage = coverage.length ? Math.min(...coverage.map((item) => item.actual)) : 0;
  const highestCoverage = coverage.length ? Math.max(...coverage.map((item) => item.actual)) : 0;
  const balanceRatio = highestCoverage ? lowestCoverage / highestCoverage : 1;
  const minimumBalanceRatio = lesson?.coverageBalanceMinimum ?? 0.4;
  if (requiresBalancedCoverage && balanceRatio < minimumBalanceRatio) issues.push("focus-imbalance");

  return {
    valid: issues.length === 0,
    issues,
    wordCount: words.length,
    coverage,
    balance: {
      required: requiresBalancedCoverage,
      ratio: balanceRatio,
      minimumRatio: requiresBalancedCoverage ? minimumBalanceRatio : null,
    },
  };
}

export function assessGuidedLessonContent({ lesson, exercise, text, targetWords = exercise?.targetWords } = {}) {
  const base = assessLessonPracticeContent({ lesson, exercise, text, targetWords });
  const value = String(text || "");
  const words = value.trim().split(/\s+/).filter(Boolean);
  const normalisedWords = words.map(normaliseItem);
  const uniqueWords = new Set(normalisedWords);
  const candidateCount = lesson && exercise
    ? getGuidedCandidateTokens(lesson, exercise).length
    : 0;
  const requiredWords = Math.max(10, Number(targetWords) || 10);
  const minimumUniqueRatio = Math.min(0.55, Math.max(0.12, (candidateCount / requiredWords) * 0.7));
  const issues = [...base.issues];

  if (!exercise && !issues.includes("missing-context")) issues.push("missing-context");
  if (normalisedWords.some((word, index) => index > 0 && word === normalisedWords[index - 1])) issues.push("immediate-repeat");
  if (words.length && uniqueWords.size / words.length < minimumUniqueRatio) issues.push("low-variety");

  return {
    ...base,
    valid: issues.length === 0,
    issues,
    uniqueRatio: words.length ? uniqueWords.size / words.length : 1,
    minimumUniqueRatio,
  };
}

function buildMetadata(text, items, recipe) {
  const cleanItems = items.map((item) => String(item).trim()).filter(Boolean);
  const uniqueItems = unique(cleanItems.map(normaliseItem));
  const focusedItems = cleanItems.filter((item) => focusScore(item, recipe) > 0).length;
  let immediateRepeats = 0;
  for (let index = 1; index < cleanItems.length; index += 1) {
    if (normaliseItem(cleanItems[index]) === normaliseItem(cleanItems[index - 1])) immediateRepeats += 1;
  }
  const motor = summariseMotorDifficulty(cleanItems, { frequencyIndex, totalWords: commonWords.length });
  return {
    fingerprint: hashText(text),
    items: unique(cleanItems).slice(0, 80).map((item) => item.slice(0, 240)),
    wordCount: countWords(text),
    uniqueRatio: cleanItems.length ? uniqueItems.length / cleanItems.length : 1,
    repeatRate: cleanItems.length > 1 ? immediateRepeats / (cleanItems.length - 1) : 0,
    immediateRepeats,
    focusDensity: cleanItems.length ? focusedItems / cleanItems.length : 0,
    focusedItems,
    totalItems: cleanItems.length,
    purpose: recipe.purpose || "balanced",
    contentType: recipe.contentType || "words",
    category: recipe.category || "general",
    documentStyle: recipe.documentStyle || null,
    difficulty: recipe.difficulty || "balanced",
    difficultyTarget: recipe.difficultyTarget || null,
    featurePolicy: recipe.featurePolicy || null,
    lessonId: recipe.lessonId || null,
    exerciseId: recipe.exerciseId || null,
    guidedStage: recipe.guidedStage || null,
    reviewScope: recipe.reviewScope || null,
    checkpointModuleId: recipe.checkpointModuleId || null,
    curriculumVersion: recipe.curriculumVersion || null,
    contentVersion: recipe.contentVersion || null,
    motor,
    featureCounts: {
      capitals: (String(text).match(/[A-Z]/g) ?? []).length,
      punctuation: (String(text).match(/[.,;:!?()'"-]/g) ?? []).length,
      numbers: (String(text).match(/[0-9]/g) ?? []).length,
    },
  };
}

function legacyRecipe(config = {}, context = {}) {
  return {
    ...config,
    purpose: config.purpose || (config.contentType === "smart" ? "adaptive" : "balanced"),
    contentType: config.contentType === "smart" ? "words" : (config.contentType || "words"),
    focusKeys: config.focusKeys?.length ? config.focusKeys : (context.weakKeys ?? []),
    focusBigrams: config.focusBigrams ?? [],
    confusionPairs: config.confusionPairs ?? [],
    recoveryWords: config.recoveryWords ?? [],
    targetDensity: Number(config.targetDensity) || (config.contentType === "smart" ? 0.38 : 0.12),
    recentExclusions: context.recentExclusions ?? { items: [], fingerprints: [] },
  };
}

export function getCategoryPool(category = "general") {
  return unique(categoryPools[category] ?? categoryPools.general);
}

export function estimateTargetWords(config) {
  if (config.goalType === "words") return Math.max(10, Number(config.wordCount) || 50);
  const minutes = Math.max(0.25, (Number(config.durationSeconds) || 60) / 60);
  // Keep enough unseen text for at least 180 WPM plus a safety margin.
  return Math.ceil(minutes * 200) + 50;
}

function generatePracticeSessionOnce(recipe, seed) {
  const targetWords = estimateTargetWords(recipe);
  const category = recipe.category || "general";
  const recentItems = recipe.recentExclusions?.items ?? [];
  let text = "";
  let items = [];

  if (recipe.contentType === "custom") {
    const customText = (recipe.customText || "").trim();
    if (!customText) return { text: "", metadata: buildMetadata("", [], recipe) };
    if (recipe.goalType === "time") {
      const generated = buildTextSequence([customText], targetWords, { ...recipe, recentExclusions: { items: [] } }, seed);
      text = generated.text;
      items = generated.items;
    } else {
      text = customText;
      items = customText.split(/\s+/);
    }
  } else if (recipe.contentType === "numbers") {
    text = generateNumberText(Math.max(30, Math.ceil(targetWords * 0.9)), seed);
    items = text.split(/\s+/);
  } else if (recipe.contentType === "sentences") {
    const generatedBank = generateNaturalSentenceBank(
      category,
      seed,
      Math.max(220, Math.ceil(targetWords / 5) + 30),
      recentItems,
    );
    const bank = unique([...(sentenceBanks[category] ?? sentenceBanks.general), ...generatedBank]);
    const minimumSentenceItems = recipe.goalType === "time"
      ? Math.max(12, Math.ceil((Number(recipe.durationSeconds) || 60) / 300 * 45))
      : Math.max(8, Math.ceil(targetWords / 14));
    const generated = buildTextSequence(bank, targetWords, recipe, seed + 17, minimumSentenceItems);
    text = generated.text;
    items = generated.items;
  } else if (recipe.contentType === "paragraphs") {
    const naturalSentences = generateNaturalSentenceBank(
      category,
      seed + 41,
      Math.max(270, Math.ceil(targetWords / 5) + 60),
      recentItems,
    );
    const generatedParagraphs = [];
    for (let index = 0; index + 2 < naturalSentences.length; index += 3) {
      generatedParagraphs.push(`${naturalSentences[index]} ${naturalSentences[index + 1]} ${naturalSentences[index + 2]}`);
    }
    const bank = unique([...(paragraphBanks[category] ?? paragraphBanks.general), ...quotes, ...generatedParagraphs]);
    const generated = buildTextSequence(bank, targetWords, recipe, seed + 71);
    text = generated.text;
    items = generated.items;
  } else if (recipe.contentType === "documents") {
    const bank = generatePracticalDocumentBank({
      category,
      style: recipe.documentStyle || "mixed",
      seed,
      count: Math.max(100, Math.ceil(targetWords / 28) + 25),
      recentItems,
    });
    const generated = buildTextSequence(bank, targetWords, recipe, seed + 97);
    text = generated.text;
    items = generated.items;
  } else if (recipe.contentType === "lesson") {
    const lesson = getLessonById(recipe.lessonId);
    if (!lesson) {
      const words = buildRecipeWords(commonWords, targetWords, recipe, seed);
      text = words.join(" ");
      items = words;
    } else {
      const exercise = lesson.exercises.find((item) => item.id === recipe.exerciseId) ?? null;
      const advancedText = getAdvancedLessonText(lesson, targetWords, seed, exercise);
      if (advancedText) {
        text = advancedText;
        items = advancedText.split(/\s+/);
      } else {
        const validTokens = lesson.practiceTokens.filter((token) => (
          [...token].every((char) => lesson.allowedCharacters.includes(char))
        ));
        if (exercise || validTokens.length >= 5) {
          text = buildBalancedLessonText(lesson, targetWords, seed, exercise);
        } else {
          const guidedBank = lesson.exercises
            .map((item) => sanitizeForLesson(item.target, lesson))
            .filter(Boolean);
          text = guidedBank.length > 0
            ? buildTextSequence(guidedBank, targetWords, { ...recipe, targetDensity: 0 }, seed).text
            : generateLessonPatterns(lesson, targetWords, seed);
        }
        items = text.split(/\s+/);
      }
    }
  } else {
    let pool = getCategoryPool(category);
    const resolvedDifficulty = recipe.difficulty === "adaptive"
      ? recipe.skillStage === "foundation" ? "easy" : recipe.skillStage === "advanced" ? "hard" : "balanced"
      : recipe.difficulty || "balanced";
    pool = applyDifficulty(pool, resolvedDifficulty, recipe.skillStage);
    const words = buildRecipeWords(pool, targetWords, recipe, seed);
    const random = seededRandom(seed + 19);
    text = words.map((word, index) => decorateWord(word, index, recipe, random)).join(" ");
    items = words;
  }

  return {
    text,
    metadata: buildMetadata(text, items, recipe),
  };
}

export function generatePracticeSession(config = {}, context = {}) {
  const rawRecipe = context.recipe ?? legacyRecipe(config, context);
  const recipe = {
    difficulty: "balanced",
    skillStage: "developing",
    progressiveFeatures: false,
    ...rawRecipe,
  };
  recipe.difficultyTarget ??= resolveDifficultyBand(recipe.difficulty, recipe.skillStage);
  recipe.featurePolicy ??= resolveFeatureProgression(recipe);
  const baseSeed = Number(recipe.seed ?? config.seed) || Date.now();
  const recentFingerprints = new Set(recipe.recentExclusions?.fingerprints ?? []);
  let generated = generatePracticeSessionOnce(recipe, baseSeed);
  const lesson = recipe.contentType === "lesson" ? getLessonById(recipe.lessonId) : null;
  const exercise = lesson?.exercises.find((item) => item.id === recipe.exerciseId) ?? null;
  const assessLessonOutput = () => exercise
    ? assessGuidedLessonContent({ lesson, exercise, text: generated.text, targetWords: estimateTargetWords(recipe) })
    : lesson
      ? assessLessonPracticeContent({ lesson, text: generated.text, targetWords: estimateTargetWords(recipe) })
      : null;
  let lessonQuality = assessLessonOutput();

  for (
    let attempt = 1;
    attempt <= 6 && (recentFingerprints.has(generated.metadata.fingerprint) || (lessonQuality && !lessonQuality.valid));
    attempt += 1
  ) {
    generated = generatePracticeSessionOnce(recipe, baseSeed + (attempt * 104729));
    lessonQuality = assessLessonOutput();
  }

  if (lessonQuality) generated.metadata.lessonCoverage = lessonQuality;
  if (exercise) generated.metadata.guidedQuality = lessonQuality;

  return generated;
}

export function generateGuidedLessonExercise({
  lessonId,
  exerciseId,
  seed = Date.now(),
  recentExclusions = { items: [], fingerprints: [] },
} = {}) {
  const lesson = getLessonById(lessonId);
  const exercise = lesson?.exercises.find((item) => item.id === exerciseId);
  if (!lesson || !exercise) {
    throw new Error(`Unknown guided lesson exercise: ${lessonId || "missing lesson"}/${exerciseId || "missing exercise"}`);
  }

  const literalFocus = lesson.focusKeys.map(String).filter((key) => key.length === 1);
  const focusBigrams = lesson.focusKeys.map(String).filter((key) => key.length === 2);
  const focusPatterns = lesson.focusKeys.map(String).filter((key) => key.length > 2 && !["Space", "Shift"].includes(key));
  const recipe = {
    contentType: "lesson",
    purpose: "guided",
    lessonId: lesson.id,
    exerciseId: exercise.id,
    guidedStage: exercise.stage,
    reviewScope: exercise.cumulativeReview ? "module" : "lesson",
    checkpointModuleId: exercise.cumulativeReview ? lesson.moduleId : null,
    curriculumVersion: lesson.curriculumVersion || CURRICULUM_VERSION,
    contentVersion: exercise.contentVersion || GUIDED_CONTENT_VERSION,
    goalType: "words",
    wordCount: exercise.targetWords,
    focusKeys: literalFocus,
    focusBigrams,
    focusPatterns,
    targetDensity: exercise.stage === "focus" ? 0.5 : exercise.stage === "control" ? 0.34 : 0.22,
    recentExclusions,
    seed,
  };
  return generatePracticeSession(recipe, { recipe });
}

export function generatePracticeText(config = {}, context = {}) {
  return generatePracticeSession(config, context).text;
}

export function getContentBankStats() {
  const natural = getNaturalContentStats();
  return {
    totalWords: commonWords.length,
    categories: Object.keys(categoryPools).length,
    sentences: Object.values(sentenceBanks).reduce((sum, bank) => sum + bank.length, 0) + natural.sentenceCombinationsPerCategory,
    paragraphs: Object.values(paragraphBanks).reduce((sum, bank) => sum + bank.length, 0) + practiceParagraphs.length + quotes.length + 90,
    documents: natural.documentTemplates,
    documentStyles: natural.documentStyles,
    motorDifficulty: true,
    frequencyTiers: 4,
  };
}

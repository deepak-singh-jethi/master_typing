const step = (id, title, description, target, passAccuracy = 94, options = {}) => ({
  id,
  title,
  description,
  target,
  passAccuracy,
  ...options,
});

export const COURSE_ID = "touch-typing-path";
export const CURRICULUM_VERSION = 2;
export const GUIDED_CONTENT_VERSION = 4;

const GUIDED_STAGES = ["focus", "control", "transfer"];

function getGuidedWordTargets(lessonNumber) {
  if (lessonNumber <= 6) return [32, 40, 48];
  if (lessonNumber <= 12) return [36, 50, 64];
  if (lessonNumber <= 18) return [40, 60, 75];
  if (lessonNumber <= 24) return [45, 70, 90];
  return [55, 85, 110];
}

const lesson = (config) => {
  const guidedWordTargets = getGuidedWordTargets(config.number);
  return {
    curriculumVersion: CURRICULUM_VERSION,
    estimatedMinutes: 8,
    passAccuracy: 94,
    focusKeys: [],
    practiceTokens: [],
    ...config,
    exercises: (config.exercises || []).map((exercise, index) => {
      const stage = exercise.stage || GUIDED_STAGES[index] || "control";
      return {
        ...exercise,
        stage,
        targetWords: exercise.targetWords || guidedWordTargets[index] || guidedWordTargets.at(-1),
        contentVersion: GUIDED_CONTENT_VERSION,
        cumulativeReview: exercise.cumulativeReview ?? Boolean(config.moduleCheckpoint && stage === "transfer"),
      };
    }),
  };
};

export const courseModules = [
  {
    id: "home-row",
    number: 1,
    title: "Home-row control",
    description: "Build the finger map and learn to return to the anchor keys without looking down.",
  },
  {
    id: "top-row",
    number: 2,
    title: "Top-row reaches",
    description: "Add the upper row while keeping the palms quiet and the home position stable.",
  },
  {
    id: "bottom-row",
    number: 3,
    title: "Bottom-row reaches",
    description: "Complete the alphabet with short downward reaches and controlled returns.",
  },
  {
    id: "control",
    number: 4,
    title: "Typing control",
    description: "Practise capitals, punctuation, numbers, common words, and difficult transitions.",
  },
  {
    id: "real-world",
    number: 5,
    title: "Real-world fluency",
    description: "Transfer the finger map into practical sentences, forms, emails, and sustained typing.",
  },
];

export const lessons = [
  lesson({
    id: "home-f-j",
    number: 1,
    moduleId: "home-row",
    title: "F and J anchors",
    subtitle: "Find home position without looking",
    focusKeys: ["f", "j", "Space"],
    allowedCharacters: "fj ",
    technique: "Place the left index finger on F and the right index finger on J. Feel the raised marks, keep the wrists neutral, and use either thumb for Space.",
    fingerCue: "Left index → F · Right index → J",
    practiceTokens: ["f", "j", "fj", "jf", "ff", "jj"],
    exercises: [
      step("anchors", "Anchor taps", "Return to the raised keys after every press.", "f j f j ff jj fj jf f j"),
      step("alternation", "Even alternation", "Keep both hands relaxed and match an even rhythm.", "fj jf fj jf ff jj fjfj jfjf"),
      step("space", "Space control", "Use one thumb without moving the whole hand.", "f j fj jf f f j j fj jf"),
    ],
  }),
  lesson({
    id: "home-d-k",
    number: 2,
    moduleId: "home-row",
    title: "D and K",
    subtitle: "Add the middle fingers",
    focusKeys: ["d", "k"],
    allowedCharacters: "fjdk ",
    technique: "Use the left middle finger for D and the right middle finger for K. After every tap, let the index fingers remain anchored on F and J.",
    fingerCue: "Left middle → D · Right middle → K",
    practiceTokens: ["fd", "jk", "df", "kj", "dk", "kd", "fjd", "jfk"],
    exercises: [
      step("reach", "Middle-finger reaches", "Move only the working finger.", "fd jk fd jk df kj fdjk kjdf"),
      step("control", "Four-key control", "Keep the same rhythm while the pattern changes.", "f d j k fd jk dk fj k d j f"),
      step("sequence", "Short sequences", "Do not chase speed; make every return deliberate.", "fjd jfk dfd kjk fdjk dkfj"),
    ],
  }),
  lesson({
    id: "home-s-l",
    number: 3,
    moduleId: "home-row",
    title: "S and L",
    subtitle: "Ring-finger control",
    focusKeys: ["s", "l"],
    allowedCharacters: "fjdksl ",
    technique: "Use the left ring finger for S and the right ring finger for L. Avoid turning the wrists inward; the movement should come from the fingers.",
    fingerCue: "Left ring → S · Right ring → L",
    practiceTokens: ["fs", "jl", "sd", "lk", "sl", "ls", "sdf", "jkl"],
    exercises: [
      step("reach", "Ring-finger reaches", "Keep F and J as your reference points.", "fs jl fs jl sf lj sd lk"),
      step("control", "Six-key control", "Use only the keys learned so far.", "sdf jkl dsl kjf sfl lsd fjs kld"),
      step(
        "rhythm",
        "Six-key recap",
        "Mix every key learned so far and keep both hands balanced.",
        "s l d k f j sl dk fj ls kd jf",
        94,
        { cumulativeReview: true, reviewTargets: ["f", "j", "d", "k", "s", "l"] },
      ),
    ],
  }),
  lesson({
    id: "home-a-semicolon",
    number: 4,
    moduleId: "home-row",
    title: "A and semicolon",
    subtitle: "Complete the outer home row",
    focusKeys: ["a", ";"],
    allowedCharacters: "asdfjkl; ",
    technique: "Use the left pinky for A and the right pinky for semicolon. Keep the wrists straight and let the pinkies make a short sideways reach.",
    fingerCue: "Left pinky → A · Right pinky → ;",
    practiceTokens: ["ask", "all", "fall", "sad", "salad", "flask", "lass", "dad", "add", "a;", ";a", "falls;", "ask;"],
    exercises: [
      step("reach", "Pinky reaches", "Return immediately to the home position.", "as l; as l; sa ;l a; ;a"),
      step("words", "First real words", "Read the whole word before typing it.", "ask all fall sad salad flask lass dad add"),
      step("phrase", "Home-row phrase", "Keep a light rhythm through spaces.", "a sad lad falls; a lass asks dad"),
    ],
  }),
  lesson({
    id: "home-g-h",
    number: 5,
    moduleId: "home-row",
    title: "G and H",
    subtitle: "Inner index-finger reaches",
    focusKeys: ["g", "h"],
    allowedCharacters: "asdfghjkl; ",
    technique: "Use the left index finger for G and the right index finger for H. The other fingers should stay close to home row.",
    fingerCue: "Left index → G · Right index → H",
    practiceTokens: ["glass", "flag", "half", "shall", "hash", "flash", "dash", "glad", "hall", "salsa"],
    exercises: [
      step("reach", "Inner reaches", "Move the index fingers inward without shifting the palms.", "fg jh fg jh gf hj gh hg"),
      step("words", "Home-row words", "Use smooth groups instead of isolated letters.", "glass flag half shall hash flash dash glad hall"),
      step("phrase", "Home-row fluency", "Stay accurate through repeated letter patterns.", "a glad lad shall flash a flag; a lass falls"),
    ],
  }),
  lesson({
    id: "home-row-fluency",
    number: 6,
    moduleId: "home-row",
    moduleCheckpoint: true,
    title: "Home-row fluency",
    subtitle: "Turn the key map into rhythm",
    focusKeys: ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
    coverageBalance: true,
    allowedCharacters: "asdfghjkl; ",
    technique: "Look at the screen, read one word ahead, and let every finger return to its home key after a reach.",
    fingerCue: "All home-row fingers",
    practiceTokens: ["add", "ask", "dad", "fall", "flag", "flash", "glad", "glass", "half", "hall", "hash", "lad", "lass", "sad", "salad", "shall", "jag", "jags", "fj", "jh", "jkl;", "falls;", "flash;", "a;"],
    exercises: [
      step("map", "Full-row map", "Keep the hands still while all ten home keys work.", "asdf jkl; fdsa ;lkj asdfghjkl; ;lkjhgfdsa fj gh jk l;"),
      step("words", "Word rhythm", "Type familiar words with clean spaces.", "glass shall fall; glad salad flash; hall ask half; jag jags"),
      step("apply", "Home-row application", "Complete the line without looking down.", "a jag falls; a glad lass asks; a flash flag; jh fj jkl;"),
    ],
  }),
  lesson({
    id: "top-e-i",
    number: 7,
    moduleId: "top-row",
    title: "E and I",
    subtitle: "First upward reaches",
    focusKeys: ["e", "i"],
    allowedCharacters: "asdfghjkl;ei ",
    technique: "Reach E with the left middle finger and I with the right middle finger. Return to D and K after every tap.",
    fingerCue: "Left middle → E · Right middle → I",
    practiceTokens: ["idea", "file", "life", "side", "safe", "lead", "deal", "feel", "self", "else", "idle", "field"],
    exercises: [
      step("reach", "Upward reaches", "Keep the palms level while the middle fingers move.", "de ki de ki ed ik ei ie"),
      step("words", "Useful words", "Use the new keys inside familiar shapes.", "idea file life side safe lead deal feel self else"),
      step("apply", "Short phrase", "Maintain spacing and rhythm.", "a safe file is ideal; add a field if safe"),
    ],
  }),
  lesson({
    id: "top-r-u",
    number: 8,
    moduleId: "top-row",
    title: "R and U",
    subtitle: "Index fingers reach upward",
    focusKeys: ["r", "u"],
    allowedCharacters: "asdfghjkl;eiru ",
    technique: "Reach R with the left index finger and U with the right index finger. Avoid lifting the entire hand.",
    fingerCue: "Left index → R · Right index → U",
    practiceTokens: ["read", "sure", "rule", "rise", "user", "dual", "raise", "ideal", "failure", "regular", "guide", "field"],
    exercises: [
      step("reach", "Index reaches", "Return to F and J after each upward movement.", "fr ju fr ju rf uj ru ur"),
      step("words", "Useful words", "Build smooth transitions between rows.", "read sure rule rise user dual raise ideal failure"),
      step("apply", "Study phrase", "Read ahead and keep an even pace.", "read a useful guide; raise a fair idea"),
    ],
  }),
  lesson({
    id: "top-w-o",
    number: 9,
    moduleId: "top-row",
    title: "W and O",
    subtitle: "Ring fingers reach upward",
    focusKeys: ["w", "o"],
    allowedCharacters: "asdfghjkl;eiruwo ",
    technique: "Reach W with the left ring finger and O with the right ring finger. Keep the wrist line straight.",
    fingerCue: "Left ring → W · Right ring → O",
    practiceTokens: ["allow", "flow", "follow", "good", "low", "road", "row", "show", "slow", "word", "work", "world", "wool", "door"],
    exercises: [
      step("reach", "Ring reaches", "Let the ring fingers move independently.", "sw lo sw lo ws ol wo ow"),
      step("words", "Useful words", "Keep repeated letters light.", "work word slow show low world follow row good"),
      step(
        "apply",
        "Six-key reach recap",
        "Use all six top-row reaches inside real words and a short phrase.",
        "slow work allows good flow; follow a wide road",
        94,
        { cumulativeReview: true, reviewTargets: ["e", "i", "r", "u", "w", "o"] },
      ),
    ],
  }),
  lesson({
    id: "top-q-p",
    number: 10,
    moduleId: "top-row",
    title: "Q and P",
    subtitle: "Pinky reaches on the top row",
    focusKeys: ["q", "p"],
    allowedCharacters: "asdfghjkl;eiruwopq ",
    technique: "Use the left pinky for Q and the right pinky for P. Make a small reach and return quickly.",
    fingerCue: "Left pinky → Q · Right pinky → P",
    practiceTokens: ["appeal", "appear", "equal", "equip", "page", "paper", "people", "please", "proper", "require", "replies", "upper", "queue", "peer"],
    exercises: [
      step("reach", "Pinky reaches", "Keep the palms centred over home row.", "aq ;p aq ;p qa p; qp pq"),
      step("words", "Useful words", "Do not overreach for repeated P or Q.", "page paper people equal equip appear proper require"),
      step("apply", "Natural phrase", "Keep the right pinky relaxed.", "people require equal replies; proper rules are useful"),
    ],
  }),
  lesson({
    id: "top-t-y",
    number: 11,
    moduleId: "top-row",
    title: "T and Y",
    subtitle: "Complete the upper row",
    focusKeys: ["t", "y"],
    allowedCharacters: "asdfghjkl;qwertyuiop ",
    technique: "Use the left index finger for T and the right index finger for Y. Make a short diagonal reach without stretching the hand.",
    fingerCue: "Left index → T · Right index → Y",
    practiceTokens: ["after", "effort", "early", "quiet", "report", "steady", "study", "theory", "today", "truly", "type", "write", "your", "yet"],
    exercises: [
      step("reach", "Centre reaches", "Return immediately to F and J.", "ft jy ft jy tf yj ty yt"),
      step("words", "Useful words", "Read the word before beginning it.", "type study today truly yet your theory report"),
      step("apply", "Study phrase", "Keep a calm pace through common words.", "type your study report today with steady effort"),
    ],
  }),
  lesson({
    id: "top-row-fluency",
    number: 12,
    moduleId: "top-row",
    moduleCheckpoint: true,
    title: "Top-row fluency",
    subtitle: "Use the top and home rows together",
    focusKeys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    allowedCharacters: "asdfghjkl;qwertyuiop ",
    technique: "Read one or two words ahead and trust the finger assignments. The wrists should remain quiet while the fingers travel.",
    fingerCue: "All top-row reaches",
    practiceTokens: ["after", "effort", "essay", "quiet", "queen", "query", "read", "report", "paper", "people", "study", "theory", "they", "this", "today", "type", "will", "with", "write", "you", "your"],
    exercises: [
      step("map", "Top-row map", "Alternate rows without losing home position.", "qwer uiop qwertyuiop poiuytrew q p qp pq asdf jkl;"),
      step("words", "Frequent words", "Keep common words smooth and automatic.", "the you are with this your they will write today quiet queen paper people"),
      step("apply", "Top-row sentence", "Prioritise accuracy over speed.", "you will write your report with quiet effort today; prepare a proper query"),
    ],
  }),
  lesson({
    id: "bottom-c-comma",
    number: 13,
    moduleId: "bottom-row",
    title: "C and comma",
    subtitle: "First downward reaches",
    focusKeys: ["c", ","],
    allowedCharacters: "asdfghjkl;qwertyuiopc, ",
    technique: "Reach C with the left middle finger and comma with the right middle finger. Return to D and K after each press.",
    fingerCue: "Left middle → C · Right middle → ,",
    practiceTokens: ["care", "case", "choice", "circle", "class", "clear", "close", "correct", "course", "create", "focus", "office", "practice", "process", "clear,", "care,", "correct,", "close,"],
    exercises: [
      step("reach", "Downward taps", "Keep the reach short and controlled.", "dc k, dc k, cd ,k c, ,c"),
      step("words", "Useful words", "Let the C key join familiar word patterns.", "case care class clear circle choice correct course"),
      step("apply", "Comma control", "Add one space after each comma.", "clear, careful, correct, close, crisp"),
    ],
  }),
  lesson({
    id: "bottom-v-m",
    number: 14,
    moduleId: "bottom-row",
    title: "V and M",
    subtitle: "Index fingers reach downward",
    focusKeys: ["v", "m"],
    allowedCharacters: "asdfghjkl;qwertyuiopcvm, ",
    technique: "Reach V with the left index finger and M with the right index finger, then return to F and J.",
    fingerCue: "Left index → V · Right index → M",
    practiceTokens: ["calm", "come", "email", "improve", "make", "message", "move", "review", "save", "time", "value", "view", "voice", "volume"],
    exercises: [
      step("reach", "Index reaches", "Avoid moving the whole hand downward.", "fv jm fv jm vf mj vm mv"),
      step("words", "Useful words", "Keep M and V movements small.", "move make time value improve review message calm"),
      step("apply", "Natural phrase", "Stay relaxed through repeated transitions.", "move with calm rhythm; improve every time"),
    ],
  }),
  lesson({
    id: "bottom-x-period",
    number: 15,
    moduleId: "bottom-row",
    title: "X and period",
    subtitle: "Ring fingers reach downward",
    focusKeys: ["x", "."],
    allowedCharacters: "asdfghjkl;qwertyuiopcvmx,. ",
    technique: "Reach X with the left ring finger and period with the right ring finger. Keep both wrists neutral.",
    fingerCue: "Left ring → X · Right ring → .",
    practiceTokens: ["complex", "exact", "example", "express", "extra", "maximum", "relax", "text", "texture", "mix", "six", "tax", "pixel", "exercise", "text.", "exact.", "relax.", "example."],
    exercises: [
      step("reach", "Ring reaches", "Return to S and L after every downward tap.", "sx l. sx l. xs .l x. .x"),
      step("words", "Useful words", "Keep X light inside longer words.", "text exact extra example complex express relax exercise"),
      step(
        "apply",
        "Six-key reach recap",
        "Mix the first six lower-row keys and finish each sentence cleanly.",
        "review a complex choice, then type the exact example.",
        94,
        { cumulativeReview: true, reviewTargets: ["c", ",", "v", "m", "x", "."] },
      ),
    ],
  }),
  lesson({
    id: "bottom-z-slash",
    number: 16,
    moduleId: "bottom-row",
    title: "Z and slash",
    subtitle: "Pinky reaches on the bottom row",
    focusKeys: ["z", "/"],
    allowedCharacters: "asdfghjkl;qwertyuiopcvmx,z./ ",
    technique: "Use the left pinky for Z and the right pinky for slash. Do not twist the wrists to reach either key.",
    fingerCue: "Left pinky → Z · Right pinky → /",
    practiceTokens: ["fizz", "hazy", "jazz", "lazy", "maze", "quiz", "size", "zero", "zip", "read/write", "save/load", "add/edit", "copy/paste"],
    exercises: [
      step("reach", "Pinky reaches", "Keep the motion compact.", "az ;/ az ;/ za /; z/ /z"),
      step("words", "Useful patterns", "Use Z without shifting the left wrist.", "zero size lazy hazy maze jazz quiz fizz"),
      step("apply", "Slash control", "Treat the slash as part of the word rhythm.", "read/write save/load add/edit copy/paste"),
    ],
  }),
  lesson({
    id: "bottom-b-n",
    number: 17,
    moduleId: "bottom-row",
    title: "B and N",
    subtitle: "Complete the alphabet",
    focusKeys: ["b", "n"],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyz;,./ ",
    technique: "Use the left index finger for B and the right index finger for N. Keep each hand responsible for its own centre key.",
    fingerCue: "Left index → B · Right index → N",
    practiceTokens: ["balance", "begin", "benefit", "between", "button", "number", "build", "browser", "bank", "blank", "bonus", "branch", "bring", "business"],
    exercises: [
      step("reach", "Centre reaches", "Return to F and J after each diagonal reach.", "fb jn fb jn bf nj bn nb"),
      step("words", "Useful words", "Keep B and N under separate hands.", "begin number button benefit balance between build browser"),
      step("apply", "Natural phrase", "Use the complete alphabet with control.", "begin with balance and build a better habit."),
    ],
  }),
  lesson({
    id: "alphabet-fluency",
    number: 18,
    moduleId: "bottom-row",
    moduleCheckpoint: true,
    title: "Alphabet fluency",
    subtitle: "Connect all three letter rows",
    focusKeys: [],
    coverageTargets: [..."abcdefghijklmnopqrstuvwxyz"],
    coverageBalanceMinimum: 0.15,
    allowedCharacters: "abcdefghijklmnopqrstuvwxyz;,./ ",
    technique: "Use all letter keys with relaxed returns to home row. Look at the screen and avoid checking the keyboard after a mistake.",
    fingerCue: "Full alphabet",
    practiceTokens: ["quick", "brown", "fox", "jumps", "over", "lazy", "dog", "project", "value", "keyboard", "study", "message", "document", "improve", "balance"],
    exercises: [
      step("alphabet", "Alphabet control", "Use the complete key map in both directions.", "abcdefghijklmnopqrstuvwxyz zyxwvutsrqponmlkjihgfedcba"),
      step("pangram", "Balanced vocabulary", "Keep rare letters controlled.", "quick brown fox jumps over the lazy dog with calm focus"),
      step("apply", "Mixed words", "Group letters into whole-word movements.", "project value keyboard study message document improve balance"),
    ],
  }),
  lesson({
    id: "common-words",
    number: 19,
    moduleId: "control",
    title: "Common-word rhythm",
    subtitle: "Automate the words used every day",
    focusKeys: [],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyz;,./ ",
    technique: "Read one or two words ahead and type in smooth groups. Do not pause after every character.",
    fingerCue: "Whole-word rhythm",
    practiceTokens: ["the", "of", "and", "to", "in", "is", "you", "that", "it", "for", "on", "are", "as", "with", "they", "this", "from", "have", "will", "your", "work", "study"],
    exercises: [
      step("frequent", "High-frequency set", "Keep short words light and even.", "the of and to in is you that it for on are as with they this"),
      step("work", "Everyday work", "Type familiar practical vocabulary.", "email report meeting project update schedule document account message form"),
      step("study", "Study words", "Use a consistent pace through longer words.", "question answer chapter subject revision practice concept example result"),
    ],
  }),
  lesson({
    id: "capital-letters",
    number: 20,
    moduleId: "control",
    title: "Capital letters",
    subtitle: "Use the opposite Shift key",
    focusKeys: ["Shift"],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ;,./ ",
    technique: "Use the opposite hand for Shift: left Shift for right-hand letters and right Shift for left-hand letters. Release Shift before typing the next lowercase letter.",
    fingerCue: "Opposite pinky → Shift",
    practiceTokens: [
      "Monday", "India", "Project", "July", "Neha", "Online", "Kolkata", "London", "Human", "User", "Number", "Journal", "People", "Yellow", "Language", "Keep",
      "Friday", "Delhi", "Report", "Review", "Application", "Student", "Typing", "Aman", "Course", "Value", "Example", "Work", "Goal", "Focus", "Balance",
    ],
    exercises: [
      step(
        "names",
        "Left Shift support",
        "Hold left Shift for capitals typed by the right hand, then release it cleanly.",
        "India July Monday Neha Online Kolkata",
        94,
        { shiftHand: "left" },
      ),
      step(
        "sentences",
        "Right Shift support",
        "Hold right Shift for capitals typed by the left hand without twisting the wrist.",
        "Aman Friday Delhi Report Student Typing",
        94,
        { shiftHand: "right" },
      ),
      step("apply", "Both Shift keys", "Choose the opposite Shift key and use capitals only where required.", "The Project Report is ready for Monday Review."),
    ],
  }),
  lesson({
    id: "punctuation",
    number: 21,
    moduleId: "control",
    title: "Punctuation",
    subtitle: "Make symbols part of the rhythm",
    focusKeys: [",", ".", "?", "'", ";", ":"],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ;,./?' :-",
    technique: "Treat punctuation as part of the word. Add one space after a comma or full stop and use the opposite Shift key for shifted symbols.",
    fingerCue: "Right-hand symbol control",
    practiceTokens: ["clear,", "ready?", "don't", "it's", "note:", "answer;", "well-written", "today."],
    exercises: [
      step("comma", "Comma and colon rhythm", "Add exactly one space after each comma and pause after a label.", "Focus: clear, calm, steady, accurate, focused."),
      step("questions", "Questions", "Coordinate Shift without holding it too long.", "Question: are you ready? Ready. Is the report complete? What comes next?"),
      step("apply", "Apostrophes and pauses", "Keep punctuation inside the phrase rhythm.", "Note: don't rush; pause; check; it's better to type what's correct."),
    ],
  }),
  lesson({
    id: "numbers-dates",
    number: 22,
    moduleId: "control",
    title: "Numbers and dates",
    subtitle: "Control the number row",
    focusKeys: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    coverageBalance: true,
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;,./?' :-₹",
    technique: "Reach the number row without looking down, then return to home position. Accuracy matters more than speed when entering figures.",
    fingerCue: "Number-row reaches",
    practiceTokens: ["2026", "1500", "250", "75", "42", "108", "31/07/2026", "4:30", "2048", "1250.50", "9", "19", "90", "99", "219"],
    passAccuracy: 95,
    exercises: [
      step("groups", "Number groups", "Use the correct finger for each number.", "0123456789 9876543210 1029384756 5647382910 2026 1500", 95),
      step("dates", "Dates", "Keep slash placement exact.", "31/07/2026 15/08/1947 26/01/1950 01/01/2027", 95),
      step("apply", "Practical figures", "Check every character before moving on.", "Codes 13579 and 24680; invoice 2048; total 9876.50; due in 30 days.", 95),
    ],
  }),
  lesson({
    id: "transition-control",
    number: 23,
    moduleId: "control",
    moduleCheckpoint: true,
    title: "Difficult transitions",
    subtitle: "Train common letter pairs and repeated letters",
    focusKeys: ["th", "ing", "tion", "qu", "ll", "ss"],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;,./?' :-",
    technique: "Practise common letter groups as one movement. Stay relaxed through repeated letters and alternate hands cleanly.",
    fingerCue: "Bigrams and trigrams",
    practiceTokens: ["the", "this", "that", "thing", "typing", "learning", "question", "quick", "quality", "application", "information", "collection", "success", "address"],
    exercises: [
      step("bigrams", "Common pairs", "Keep the pairs connected.", "the this that with which quick quality question"),
      step("trigrams", "Common endings", "Type the ending as a familiar unit.", "typing learning reading working training application information"),
      step("repeats", "Repeated letters", "Use two light taps instead of holding the key.", "address success collect follow better little message correct"),
    ],
  }),
  lesson({
    id: "practical-sentences",
    number: 24,
    moduleId: "real-world",
    title: "Practical sentences",
    subtitle: "Transfer technique into normal writing",
    focusKeys: [],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;,./?' :-",
    technique: "Read ahead, maintain an even rhythm, and correct errors without panic. Sentence typing should feel like continuous movement rather than separate words.",
    fingerCue: "Natural sentence flow",
    passAccuracy: 95,
    exercises: [
      step("study", "Study note", "Preserve punctuation and sentence rhythm.", "The chapter explains the main causes, important events, and final results in a clear sequence.", 95),
      step("work", "Work message", "Keep the wording and punctuation exact.", "Please review the attached document and send your comments before the meeting tomorrow.", 95),
      step("form", "Form entry", "Check names, dates, and reference numbers.", "Name: Deepak Singh. Application date: 31/07/2026. Reference number: 2048.", 95),
    ],
  }),
  lesson({
    id: "emails-forms",
    number: 25,
    moduleId: "real-world",
    title: "Emails and forms",
    subtitle: "Practise common digital tasks",
    focusKeys: ["@", ".", ":", "-"],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;,./?' :@-_",
    technique: "Slow down for names, addresses, dates, and identifiers. A practical typist checks exact characters instead of relying on context.",
    fingerCue: "Precision entry",
    passAccuracy: 96,
    exercises: [
      step("email", "Email message", "Use capitals and punctuation exactly.", "From: learner@example.com. To: team@example.com. Subject: Project Update - Friday review.", 96),
      step("contact", "Contact details", "Treat every character as meaningful.", "Email: learner@example.com. Reference: TM-2048. Date: 31/07/2026.", 96),
      step("request", "Formal request", "Keep a professional sentence rhythm.", "Request ID: TM-3091. Please confirm that the application was received and note any missing documents.", 96),
    ],
  }),
  lesson({
    id: "endurance",
    number: 26,
    moduleId: "real-world",
    title: "Endurance and consistency",
    subtitle: "Hold technique through longer text",
    focusKeys: [],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;,./?' :@-_",
    technique: "Use a sustainable pace. Relax the shoulders, breathe normally, and avoid reacting to every small speed change.",
    fingerCue: "Steady pace over time",
    estimatedMinutes: 12,
    passAccuracy: 95,
    exercises: [
      step("paragraph", "Controlled paragraph", "Keep the same technique from the first line to the last.", "A focused learner measures progress over weeks rather than minutes. Some sessions feel slow, but consistent practice gradually improves rhythm, control, and endurance. Short, accurate sessions are more useful than rushed attempts that create tension and repeated errors.", 95),
      step("work", "Practical paragraph", "Read one phrase ahead and keep moving.", "The weekly report should include completed tasks, pending decisions, current risks, and the next planned action. Use short headings so that every section is easy to scan, and check all dates and figures before sharing the document.", 95),
      step("study", "Study paragraph", "Finish with controlled accuracy.", "A useful revision note explains the central idea, important facts, common mistakes, and one practical example. It should be short enough to review quickly but complete enough to understand when the topic is revised later.", 95),
    ],
  }),
  lesson({
    id: "foundation-assessment",
    number: 27,
    moduleId: "real-world",
    moduleCheckpoint: true,
    title: "Foundation assessment",
    subtitle: "Confirm accuracy, control, and practical fluency",
    focusKeys: [],
    allowedCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;,./?' :@-_",
    technique: "Use everything learned so far. Prioritise accuracy and consistency over a personal speed record.",
    fingerCue: "Complete keyboard foundation",
    estimatedMinutes: 15,
    passAccuracy: 96,
    exercises: [
      step("accuracy", "Accuracy check", "Complete the passage with at least 96% accuracy.", "Good typing is not a race against the keyboard. It is a controlled skill built through correct movement, careful practice, and steady repetition. A reliable typist keeps the eyes on the screen and the hands relaxed.", 96),
      step("practical", "Practical check", "Keep capitals, punctuation, and numbers exact.", "Please prepare the final report by 4:30 PM on Friday, 31 July 2026. Check every figure, heading, and reference before you submit it.", 96),
      step("final", "Foundation passage", "Finish the course with sustainable technique.", "A skilled typist returns each finger to the home row, reads ahead, and maintains a relaxed posture. Speed develops naturally when accurate movements become automatic, and progress remains stable when practice is regular and purposeful.", 96),
    ],
  }),
];

export const lessonMap = Object.fromEntries(lessons.map((item) => [item.id, item]));

export function getLessonById(id) {
  return lessonMap[id] ?? null;
}

export function getLessonIndex(id) {
  return lessons.findIndex((item) => item.id === id);
}

export function getNextLesson(id) {
  const index = getLessonIndex(id);
  return index >= 0 ? lessons[index + 1] ?? null : null;
}

export function getPreviousLesson(id) {
  const index = getLessonIndex(id);
  return index > 0 ? lessons[index - 1] : null;
}

export function getLessonsByModule(moduleId) {
  return lessons.filter((item) => item.moduleId === moduleId);
}

export function isLessonUnlocked(lessonId, completedLessons = []) {
  const index = getLessonIndex(lessonId);
  if (index <= 0) return index === 0;
  return completedLessons.includes(lessons[index - 1].id) || completedLessons.includes(lessonId);
}

export function getFirstIncompleteLesson(completedLessons = []) {
  return lessons.find((item) => !completedLessons.includes(item.id)) ?? lessons.at(-1);
}

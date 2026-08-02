const coreWords = `
about above accept account across action active activity actual add address admit advice affect after again against age agree air allow almost along already also always among amount analysis answer any appear application apply area around arrive article ask attention available average avoid away back balance base basic become before begin behind believe benefit best better between beyond big book both bring build business call can care case cause centre certain change check child choose city class clear close code college common company complete concept condition consider contact continue control correct cost course create current data date day decide decision describe design detail develop different difficult direct discuss document during each early easy education effect effort either email end enough ensure enter environment equal error especially event every example experience explain fact family far fast feature feel few field final find first focus follow form free friend from full future general get give goal good government great group grow guide hand happen hard have help high history hold home hope hour however idea important improve include increase information interest issue item job join keep key kind know language large last late later learn least leave lesson level life light like line list little local long look make many mark matter may mean measure meeting member message method might minute mobile mode modern money month more most move much must name natural near need never new next note number office often once only open order other page paper part people perhaps period person place plan point possible practice prepare present problem process produce product program project proper provide public question quick read ready real reason record reduce reference report require research result review right role room rule run same save school screen search section see select send sentence service set several short should show simple since skill small social some sound space speed start state step still store student study subject success such support system take task teach team test text than that their then theory there these thing think this through time today together tool topic total touch train try type under understand update use useful user value very view wait want way week well what when where which while who will with word work world would write year your
`;

const extendedWords = `
ability able absence absolute academic access accident accurate achieve achievement acknowledge acquire act adapt addition additional adjust administration adult advance advantage advertise affair afford afraid agency agenda agent agree agreement agriculture ahead aid aim alarm album alert alive all allocate alternative amazing ambition amend ancient announce annual another anticipate anxiety anyone apart apology appeal approach approval approve argument arise arm arrange arrangement arrest art artificial artist aspect assess assessment assign assignment assist assistance assistant assume attempt attend attitude attract audience author authority automatic autumn award aware awareness background backup bad bank bar basic battery battle beach bear beat beauty because bed bedroom behaviour belief belong below benchmark beside bicycle bill birth bit blank block blood board body bonus border borrow boss bottle bottom box branch brand break brief bright broad budget build button buyer calendar calm camera campaign cancel candidate capacity capital career carry category celebrate cell century certificate chain challenge chance character charge chart chat cheap chemical choice citizen civil claim clean client climate climb clinic clock cloud coach collect collection column combine comfort command comment commercial commission commit committee communication community compare comparison compete competition complaint complex component computer concern conclusion confirm conflict connect connection conscious consequence consider consistent constant construction consumer content context contract contrast contribution conversation copy core corporate correction council country courage court cover crash creative credit crime critical culture customer cycle daily damage danger dark database deadline deal debate debt decade declare decline decrease deep define degree delay deliver demand department depend deposit depth device digital direction discipline discount display district divide doctor domain double download draft dream drive duty earn earth eastern economy edit election electric electronic element emergency emotion employee employer enable energy engine engineering enjoy enterprise entire entry equipment escape establish estimate event evidence exact exchange executive exercise exist expand expect expense expert export express extend external extra facility factor fail failure fair familiar famous farm feedback file filter finance financial finish fire firm fitness fix flight floor flow folder force foreign forest forget formal format forward foundation frame framework fresh front function fund gain game garden general generate generation gift global grammar graph green ground habit handle hardware health hearing heart height highlight hire holiday hospital house human identify image immediate impact implement implementation import impossible incident income independent index individual industry influence input inspect install instance instruction insurance integrate intelligence intention interface internal internet interview introduction inventory invest invitation involve journey judge junior justice keyboard knowledge label labour landscape launch law layer leader leadership library license limit link local location logic login maintain maintenance major manage management manager market material maximum media medical memory menu merge middle minimum mission model monitor morning movement national nature network normal objective observation obtain obvious offer operation opportunity option organization original output owner package panel paragraph parent partner password payment performance personal phone physical picture platform policy popular position positive power practical preference pressure price primary private procedure professional profile progress proof property protect purpose quality quantity range rate recent recommend recovery region relation relationship release relevant reliable remove repair repeat replace request resource response responsibility restore result return risk route safety salary sample science score security select separate server session setting share shift shop site situation software solution source specific standard statement storage strategy structure style submit summary supply survey symbol tablet target teacher technical technique technology template term theme ticket timeline title track tradition traffic training transfer translation travel trend trial trouble trust unique unit university upload version video virtual visual vocabulary volume warning website window winner winter worker workflow workshop youth

absence absorb abstract abuse academy accelerate accent accompany accomplish according achieve acoustic acquire adaptation adequate adjacent admire adopt advanced adventure advice advocate agriculture aircraft airport aisle alert allocate alliance alphabet already alter amateur ambitious analyse analytics ancestor angle announce anonymous anticipate apartment apologize apparatus appeal appearance appetite appointment appreciate appropriate architecture archive argument arithmetic arrange arrival artificial assessment athlete atmosphere attach attachment attack attendance attitude audience audio author available balance bandwidth barrier behaviour biology birthday browser calculate calculation calendar cancel capacity capture category ceiling ceremony challenge channel chapter chemistry citizen classroom climate coding colleague command comment commerce communication community community compare compatibility compile compiler completion confidence configuration connect consistency context contract coordinate copywriting correction creator curriculum dashboard decision definition delivery deployment description desktop developer development dictionary difficulty discussion display distribution download duration editorial efficiency eligible employment encyclopedia endpoint engagement enhance enrollment error evaluation examination exclude execution experiment explanation extension feedback filename fingerprint firewall flexibility font forecast frequency frontend fundamental geography glossary graphic guidance heading homepage homework identity illustration improvement index indicator infrastructure initialize innovation input installation instructor interaction internet introduction keyboard layout learner learning lecture login management mathematics migration milestone motivation navigation notification offline onboarding operator optimization package paragraph pattern permission portfolio position precision presentation productivity pronunciation publishing qualification queue reader reading recommendation registration reminder repository responsive revision roadmap routine scholarship screenshot search session shortcut sidebar signup simulation software specification sprint statistics storage submission syllabus syntax task technique textbook timer tracking tutorial validation version visibility workstation writing

accounting invoice receipt payment payroll revenue expense budget balance deposit withdrawal transaction statement currency amount total subtotal tax discount refund credit debit purchase order customer supplier vendor stock inventory warehouse shipment delivery package address postcode contact mobile telephone email message reminder schedule appointment meeting agenda minutes report document attachment approval signature deadline priority update status request response followup teamwork manager colleague department office company business service product project task workflow process policy procedure guideline standard template form record file folder archive print scan copy paste upload download login password account profile settings dashboard notification calendar

constitution parliament president governor minister cabinet judiciary court justice law legal article amendment schedule commission committee election voter district state union federal local public policy administration governance scheme census population economy agriculture industry trade transport tourism environment forest river mountain wildlife disaster climate heritage culture history geography science technology education health employment development budget revenue expenditure survey report data statistics rank award programme mission campaign initiative authority department institution organization village town city region border national international

computer laptop desktop monitor keyboard mouse printer scanner router switch network server browser website webpage application software hardware memory processor storage database cloud internet email file folder window menu button icon link code program developer frontend backend mobile tablet device screen display audio video image camera microphone speaker battery cable port wireless bluetooth security password encryption backup update install download upload error bug fix test debug build version repository branch commit merge deployment framework library component function variable object array string number boolean condition loop event input output interface user experience design responsive accessibility performance animation transition layout typography colour spacing

accuracy speed rhythm posture finger fingers wrist wrists shoulder shoulders relax relaxed tension technique reach return home row top bottom space shift capital punctuation comma period question apostrophe semicolon colon number date sentence paragraph passage quote words letters characters typing typist keyboarding practice lesson exercise drill attempt result progress streak goal session timer timed untimed restart pause resume complete correct incorrect mistake errors backspace cursor focus consistency fluency endurance confidence control movement automatic repetition feedback improvement weakness strong weak key heatmap analytics average personal best

apple banana orange mango grape lemon coconut tomato potato onion carrot spinach cabbage pepper ginger garlic rice wheat bread milk cheese butter sugar salt coffee tea water juice breakfast lunch dinner kitchen market shop home room hall garden road street school college university library hospital bank office station airport hotel restaurant park river lake mountain valley village city country family parent mother father brother sister friend child children student teacher doctor engineer artist driver farmer worker
`;

function normalizeWordBank(text) {
  return [...new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z]/g, ""))
      .filter((word) => word.length > 0),
  )];
}

export const commonWords = normalizeWordBank(`${coreWords} ${extendedWords}`);

export const practiceParagraphs = [
  "A clear daily plan makes study more manageable. Begin with one important task, remove distractions, and work for a focused period. Take a short break before starting the next task.",
  "Please review the project document before tomorrow's meeting. Check the dates, figures, headings, and action items. Add your comments in a clear and respectful way.",
  "Typing accuracy improves when the hands stay relaxed and each finger returns to the home row. Slow, correct movement is more valuable than rushed practice with repeated mistakes.",
  "The application form requires your full name, contact number, email address, date of birth, and reference number. Read every field carefully before submitting the form.",
  "A useful revision note should explain the core idea, important facts, common mistakes, and one practical example. It should be short enough to review quickly but complete enough to understand later.",
  "Good communication is direct, polite, and easy to follow. State the purpose early, include the necessary details, and finish with a clear next action or deadline.",
  "Regular practice develops confidence because familiar movements require less conscious effort. The goal is not to force speed but to build reliable habits that remain accurate under pressure.",
  "The team completed the first version of the website and tested it on desktop and mobile screens. The next step is to improve accessibility, performance, and error handling.",
  "When entering data, verify one section at a time. Compare names, dates, amounts, and identification numbers with the source document before moving to the next record.",
  "A focused learner measures progress over weeks rather than minutes. Some sessions feel slow, but consistent practice gradually improves rhythm, control, and endurance.",
  "The weekly report should include completed tasks, pending decisions, current risks, and the next planned action. Use short headings so that every section is easy to scan.",
  "Before submitting an online form, check every required field and confirm that the uploaded document is the correct version. A final review can prevent avoidable errors.",
  "The study group agreed to revise one chapter each evening and complete a short test every Sunday. The schedule leaves enough time for review and correction.",
  "A calm posture supports accurate typing. Keep both feet stable, relax the shoulders, and place the keyboard at a comfortable distance from the body.",
  "The customer requested an updated invoice with the correct address and payment date. The accounts team prepared the document and sent it by email.",
  "A reliable backup protects important work from accidental deletion or device failure. Save current files regularly and keep a second copy in a safe location.",
  "The project dashboard shows current progress, recent activity, unresolved issues, and upcoming deadlines. Each update should be brief, accurate, and useful.",
  "Reading one or two words ahead helps the hands maintain a steady rhythm. Avoid stopping after every character unless you need to correct an error.",
  "The final answer should be based on verified information, clear reasoning, and careful review. Unsupported details should be removed rather than presented as facts.",
  "A good practice session ends before the hands become tense. Frequent short sessions usually produce better technique than one long session completed with poor posture.",
  "The office will remain closed on Monday, and normal work will resume on Tuesday morning. Urgent messages should be sent to the support address.",
  "The new lesson introduces two keys, gives controlled drills, and then uses those keys inside familiar words. Progress depends on accuracy rather than speed alone.",
  "During a timed test, keep moving forward and avoid watching the speed number after every word. Review the result only after the session ends.",
  "The research summary lists the main question, method, evidence, conclusion, and limitations. It also notes which points require further verification.",
];

export const quotes = [
  "Success is usually the result of consistent effort applied in the right direction. Small improvements repeated every day can produce a large change over time.",
  "Accuracy creates confidence. When each movement is controlled and repeatable, speed becomes a natural result rather than a forced target.",
  "The best practice session is not always the fastest one. It is the session in which you notice mistakes, correct technique, and finish with better control.",
  "Learning becomes stronger when knowledge is recalled, applied, and reviewed at useful intervals instead of being read passively only once.",
  "A clear system reduces unnecessary decisions. When the next step is obvious, more attention can be given to the quality of the work itself.",
  "Progress often looks ordinary while it is happening. The repeated actions that seem small today become the skill that feels effortless later.",
  "Reliable skill is built through careful repetition. A calm learner can improve both speed and accuracy without sacrificing technique.",
  "Good work becomes easier to repeat when the process is simple, visible, and measured with useful feedback.",
  "Patience is active practice with realistic expectations. It allows improvement to continue without turning every mistake into frustration.",
  "The purpose of a test is not only to produce a score. It should also reveal what to practise next and how progress can be measured.",
  "Confidence grows from evidence. Each accurate session proves that correct movement can become familiar, stable, and automatic.",
  "Strong habits protect performance when attention is limited. Technique learned slowly can remain reliable when the pace becomes faster.",
];

export const practicalSentences = [
  "Please send the revised report before the meeting tomorrow.",
  "The application number is printed at the top of the form.",
  "Review each answer carefully before you submit the test.",
  "The project team will discuss the next release on Friday.",
  "Save the document and keep a backup copy in another folder.",
  "Accurate typing is more useful than speed with repeated errors.",
  "The weekly plan includes study, revision, practice, and rest.",
  "Open the settings page to change the theme and keyboard view.",
  "The final total should match the amount shown on the receipt.",
  "Use a clear subject line when you send an important email.",
  "The lesson starts with two keys and ends with useful words.",
  "A short daily session can improve control over several weeks.",
  "Check the date, reference number, and contact details again.",
  "The dashboard records your recent attempts on this device.",
  "Keep the wrists relaxed and return each finger to home row.",
  "The next exercise will focus on common letter combinations.",
  "Read the complete question before selecting the final answer.",
  "The support team received the message and created a ticket.",
  "This practice text uses ordinary words from real situations.",
  "Take a brief break when the hands or shoulders feel tense.",
];

function seededRandom(seed = Date.now()) {
  let state = Math.abs(Number(seed) || 1) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function buildWordSequence(pool, wordCount = 120, seed = Date.now()) {
  const cleanPool = [...new Set(pool.filter(Boolean))];
  if (cleanPool.length === 0 || wordCount <= 0) return "";

  const random = seededRandom(seed);
  const words = [];
  let previous = "";

  for (let index = 0; index < wordCount; index += 1) {
    let word = cleanPool[Math.floor(random() * cleanPool.length)];
    if (cleanPool.length > 1 && word === previous) {
      word = cleanPool[(cleanPool.indexOf(word) + 1 + Math.floor(random() * (cleanPool.length - 1))) % cleanPool.length];
    }
    words.push(word);
    previous = word;
  }

  return words.join(" ");
}

export function generateWordText(wordCount = 120, options = {}) {
  const { seed = Date.now(), pool = commonWords } = options;
  return buildWordSequence(pool, wordCount, seed);
}

export function getRandomParagraph(seed = Date.now()) {
  const random = seededRandom(seed);
  return practiceParagraphs[Math.floor(random() * practiceParagraphs.length)];
}

export function getRandomQuote(seed = Date.now()) {
  const random = seededRandom(seed);
  return quotes[Math.floor(random() * quotes.length)];
}

export function getRandomSentenceSet(sentenceCount = 8, seed = Date.now()) {
  const random = seededRandom(seed);
  const sentences = [];
  for (let index = 0; index < sentenceCount; index += 1) {
    sentences.push(practicalSentences[Math.floor(random() * practicalSentences.length)]);
  }
  return sentences.join(" ");
}

export function generateNumberText(groupCount = 45, seed = Date.now()) {
  const random = seededRandom(seed);
  const parts = [];
  for (let index = 0; index < groupCount; index += 1) {
    const type = index % 6;
    if (type === 0) {
      const day = String(1 + Math.floor(random() * 28)).padStart(2, "0");
      const month = String(1 + Math.floor(random() * 12)).padStart(2, "0");
      const year = 2020 + Math.floor(random() * 10);
      parts.push(`${day}/${month}/${year}`);
    } else if (type === 1) {
      parts.push(String(100000 + Math.floor(random() * 900000)));
    } else if (type === 2) {
      parts.push(`${Math.floor(random() * 9999)}.${String(Math.floor(random() * 100)).padStart(2, "0")}`);
    } else if (type === 3) {
      parts.push(`${1 + Math.floor(random() * 12)}:${String(Math.floor(random() * 60)).padStart(2, "0")}`);
    } else if (type === 4) {
      parts.push(`Rs ${100 + Math.floor(random() * 9900)}`);
    } else {
      parts.push(String(Math.floor(random() * 1000)));
    }
  }
  return parts.join(" ");
}

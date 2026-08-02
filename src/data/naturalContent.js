const categorySlots = {
  general: {
    actors: ["The learner", "A careful typist", "The project team", "The support desk", "The weekly plan", "A clear message", "The final review", "The morning session", "A reliable process", "The next task"],
    actions: ["checks", "reviews", "records", "organises", "explains", "completes", "updates", "compares", "confirms", "prepares"],
    objects: ["the important details", "each required field", "the next action", "the latest result", "the complete document", "the practice target", "the saved information", "the final answer", "the remaining work", "the correct version"],
    reasons: ["before the deadline", "with calm attention", "before moving forward", "so the result remains useful", "without rushing the process", "at a sustainable pace", "before sending the message", "while the information is fresh", "to avoid a repeated mistake", "before the final check"],
  },
  study: {
    actors: ["The learner", "A revision session", "The chapter summary", "The practice test", "A verified source", "The study plan", "The final answer", "A useful note", "The weekly revision", "The question review"],
    actions: ["reviews", "explains", "connects", "checks", "records", "compares", "organises", "repeats", "summarises", "verifies"],
    objects: ["the central idea", "important dates and facts", "the incorrect answers", "the supporting evidence", "the next revision topic", "the common exam traps", "the key definitions", "the remaining questions", "the difficult concepts", "the source material"],
    reasons: ["before the next test", "with a short explanation", "before memorising details", "so recall becomes stronger", "using verified information", "at the end of the session", "without adding unsupported facts", "before the weekly review", "to improve active recall", "while the topic is still clear"],
  },
  work: {
    actors: ["The project manager", "The accounts team", "A professional email", "The meeting agenda", "The customer request", "The final report", "The office assistant", "The delivery update", "The support team", "The weekly summary"],
    actions: ["confirms", "lists", "reviews", "records", "summarises", "checks", "updates", "sends", "clarifies", "attaches"],
    objects: ["the pending actions", "the correct payment date", "the attached document", "the customer details", "the next deadline", "the revised schedule", "the approval status", "the reference number", "the requested change", "the final comments"],
    reasons: ["before the meeting", "in a clear format", "before final submission", "for the complete team", "with the correct attachment", "by the end of the day", "without unnecessary details", "before the customer replies", "to keep the record accurate", "before the next update"],
  },
  technology: {
    actors: ["The application", "The typing engine", "The responsive layout", "A clear error message", "The local backup", "The settings page", "The practice dashboard", "The browser session", "The release checklist", "The support article"],
    actions: ["stores", "displays", "protects", "updates", "checks", "records", "restores", "explains", "validates", "preserves"],
    objects: ["the learner's progress", "the current configuration", "the recent activity", "the next useful action", "the saved practice data", "the active typing result", "the device settings", "the input status", "the latest release", "the recovery state"],
    reasons: ["on this device", "after each valid session", "on mobile and desktop screens", "before a major update", "with an accessible label", "when the page opens again", "without interrupting the learner", "before saving the change", "after a network failure", "during the final test"],
  },
  government: {
    actors: ["The official notification", "The application form", "The verification team", "The district office", "The committee report", "The public record", "The candidate", "The department website", "The registration desk", "The published notice"],
    actions: ["explains", "requires", "checks", "publishes", "records", "lists", "confirms", "updates", "verifies", "summarises"],
    objects: ["the eligibility conditions", "the correct reference number", "the required documents", "the important dates", "the final recommendation", "the verified address", "the submission status", "the selection process", "the fee details", "the candidate record"],
    reasons: ["before the closing date", "in the published document", "during final verification", "for every applicant", "with accurate names and dates", "before accepting the record", "on the official website", "without relying on rumours", "before issuing the certificate", "for future reference"],
  },
};

const sentencePatterns = [
  ({ actor, action, object, reason }) => `${actor} ${action} ${object} ${reason}.`,
  ({ actor, action, object, reason }) => `${reason[0].toUpperCase()}${reason.slice(1)}, ${actor.toLowerCase()} ${action} ${object}.`,
  ({ actor, action, object, reason }) => `${actor} ${action} ${object}, then completes a second check ${reason}.`,
  ({ actor, action, object, reason }) => `${actor} ${action} ${object} ${reason} and records the next step.`,
  ({ actor, action, object, reason }) => `After a short review, ${actor.toLowerCase()} ${action} ${object} ${reason}.`,
  ({ actor, action, object, reason }) => `${actor} first ${action} ${object} ${reason}, then saves a clear copy.`,
];

const names = ["Aarav Sharma", "Meera Joshi", "Rohan Singh", "Nisha Verma", "Kabir Mehta", "Ananya Rao", "Vikram Patel", "Isha Kapoor"];
const cities = ["Dehradun", "Haldwani", "Pithoragarh", "Almora", "Haridwar", "Rudrapur", "Nainital", "Rishikesh"];
const teams = ["Project Team", "Accounts Team", "Support Desk", "Admissions Office", "Review Committee", "Training Group", "Operations Team", "Research Unit"];
const subjects = ["Project update", "Document review", "Payment confirmation", "Meeting notes", "Application status", "Revision plan", "Support request", "Verification update"];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const months = ["August", "September", "October", "November", "December"];
const actions = ["review the attached file", "confirm the revised date", "add the missing details", "verify the reference number", "reply with the final approval", "check the updated schedule", "save the signed copy", "share the corrected document"];
const PRACTICE_YEAR = new Date().getFullYear();

function seededRandom(seed = Date.now()) {
  let state = Math.abs(Number(seed) || 1) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}

function normalise(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function uniquePush(output, seen, value, signature = value) {
  const contentKey = normalise(value);
  const signatureKey = normalise(signature);
  if (!value || seen.has(contentKey) || seen.has(signatureKey)) return false;
  seen.add(contentKey);
  seen.add(signatureKey);
  output.push(value);
  return true;
}

function dateParts(index, random) {
  const day = 1 + ((index * 3 + Math.floor(random() * 9)) % 27);
  const monthNumber = 8 + (index % 5);
  const monthName = months[index % months.length];
  return {
    day,
    monthNumber,
    monthName,
    numeric: `${String(day).padStart(2, "0")}/${String(monthNumber).padStart(2, "0")}/${PRACTICE_YEAR}`,
    long: `${day} ${monthName} ${PRACTICE_YEAR}`,
  };
}

export function generateNaturalSentenceBank(category = "general", seed = Date.now(), count = 220, recentItems = []) {
  const slots = categorySlots[category] ?? categorySlots.general;
  const random = seededRandom(seed);
  const output = [];
  const seen = new Set(recentItems.map(normalise));
  let attempts = 0;

  while (output.length < count && attempts < count * 40) {
    attempts += 1;
    const actorIndex = Math.floor(random() * slots.actors.length);
    const actionIndex = Math.floor(random() * slots.actions.length);
    const objectIndex = Math.floor(random() * slots.objects.length);
    const reasonIndex = Math.floor(random() * slots.reasons.length);
    const patternIndex = Math.floor(random() * sentencePatterns.length);
    const sentence = sentencePatterns[patternIndex]({
      actor: slots.actors[actorIndex],
      action: slots.actions[actionIndex],
      object: slots.objects[objectIndex],
      reason: slots.reasons[reasonIndex],
    });
    const signature = `${category}:${actorIndex}:${actionIndex}:${objectIndex}:${reasonIndex}:${patternIndex}`;
    uniquePush(output, seen, sentence, signature);
  }

  return output;
}

function emailDocument(index, random, category) {
  const sender = pick(names, random);
  const recipient = pick(teams, random);
  const subject = category === "study" ? "Revision plan" : category === "government" ? "Application status" : pick(subjects, random);
  const day = pick(weekdays, random);
  const action = pick(actions, random);
  const ref = `${category.slice(0, 2).toUpperCase()}-${PRACTICE_YEAR}-${String(1200 + index * 17).padStart(4, "0")}`;
  return `To: ${recipient.toLowerCase().replaceAll(" ", ".")}@example.com. Subject: ${subject}. Dear ${recipient}, please ${action} before ${day} afternoon. Reference: ${ref}. Regards, ${sender}.`;
}

function meetingDocument(index, random, category) {
  const date = dateParts(index, random);
  const time = `${9 + (index % 8)}:${index % 2 ? "30" : "00"} ${index % 3 ? "AM" : "PM"}`;
  const owner = pick(teams, random);
  const topic = category === "study" ? "revision progress" : category === "government" ? "record verification" : category === "technology" ? "release readiness" : "project progress";
  return `Meeting note — ${date.long}, ${time}. Owner: ${owner}. Agenda: ${topic}, pending decisions, current risks, and next actions. Please read the supporting document and add comments before the meeting begins.`;
}

function formDocument(index, random, category) {
  const name = pick(names, random);
  const city = pick(cities, random);
  const date = dateParts(index + 3, random);
  const application = `${category.slice(0, 2).toUpperCase()}-${String(4500 + index * 23).padStart(5, "0")}`;
  const phone = `9${String(100000000 + ((index * 7919) % 899999999)).padStart(9, "0")}`;
  return `Application record. Name: ${name}. City: ${city}. Contact: ${phone}. Date: ${date.numeric}. Application ID: ${application}. Status: verification pending. Check the spelling, uploaded certificate, and contact details before final submission.`;
}

function reportDocument(index, random, category) {
  const completed = category === "study" ? "two revision chapters and one recall test" : category === "technology" ? "the responsive layout and sync recovery checks" : category === "government" ? "the document verification and candidate record review" : "the planned tasks for this reporting period";
  const pending = category === "study" ? "the remaining mock questions" : category === "technology" ? "the accessibility review and final build" : category === "government" ? "the final approval and publication note" : "the final approval and customer response";
  const risk = pick(["a delayed reply", "one missing attachment", "an unverified date", "an incorrect reference number", "a pending decision"], random);
  return `Weekly report ${index + 1}. Completed: ${completed}. Pending: ${pending}. Current risk: ${risk}. Next action: assign an owner, confirm the deadline, and update the shared record before the next review.`;
}

function noticeDocument(index, random, category) {
  const date = dateParts(index + 7, random);
  const ref = `NOTICE-${PRACTICE_YEAR}-${String(300 + index).padStart(4, "0")}`;
  const topic = category === "government" ? "document verification" : category === "study" ? "assessment schedule" : category === "technology" ? "planned maintenance" : "service update";
  return `Notice ${ref}. The revised ${topic} will begin on ${date.long}. Read the complete instructions, keep the required documents ready, and use the official contact channel for clarification. Late or incomplete records may require another review.`;
}

function dataEntryDocument(index, random, category) {
  const date = dateParts(index + 11, random);
  const amount = 750 + ((index * 137) % 9250);
  const ref = `${category.slice(0, 3).toUpperCase()}-${String(8000 + index * 31)}`;
  const city = pick(cities, random);
  return `Data entry task. Reference: ${ref}. Date: ${date.numeric}. Location: ${city}. Amount: Rs ${amount}. Status: open. Compare every field with the source document, correct any mismatch, and save the verified record.`;
}

const documentBuilders = [emailDocument, meetingDocument, formDocument, reportDocument, noticeDocument, dataEntryDocument];

export function generatePracticalDocumentBank({
  category = "general",
  style = "mixed",
  seed = Date.now(),
  count = 90,
  recentItems = [],
} = {}) {
  const random = seededRandom(seed);
  const output = [];
  const seen = new Set(recentItems.map(normalise));
  const styleMap = {
    everyday: [meetingDocument, noticeDocument, dataEntryDocument],
    email: [emailDocument, reportDocument, meetingDocument],
    forms: [formDocument, noticeDocument, dataEntryDocument],
    study: [reportDocument, meetingDocument, emailDocument],
    government: [formDocument, noticeDocument, reportDocument, dataEntryDocument],
    technology: [reportDocument, emailDocument, noticeDocument, meetingDocument],
    mixed: documentBuilders,
  };
  const builders = styleMap[style] ?? styleMap.mixed;
  let attempts = 0;

  while (output.length < count && attempts < count * 20) {
    const index = attempts;
    attempts += 1;
    const builder = builders[index % builders.length];
    const value = builder(index, random, category);
    uniquePush(output, seen, value, `${style}:${category}:${builder.name}:${index}`);
  }

  return output;
}

export function getNaturalContentStats() {
  return {
    categories: Object.keys(categorySlots).length,
    sentencePatterns: sentencePatterns.length,
    sentenceCombinationsPerCategory: Object.values(categorySlots).reduce((sum, slots) => (
      sum + (slots.actors.length * slots.actions.length * slots.objects.length * slots.reasons.length * sentencePatterns.length)
    ), 0),
    documentStyles: 7,
    documentTemplates: documentBuilders.length,
  };
}

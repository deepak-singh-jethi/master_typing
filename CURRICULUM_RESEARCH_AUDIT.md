# Typing curriculum research audit

Date: 2 August 2026

## Outcome

The 27-lesson foundation path remains intact. Every existing lesson ID and exercise ID is preserved so saved progress, links, mastery evidence, and cloud records remain compatible.

The audit found that the course already had the correct main progression: home-row anchors, paired reaches, row fluency, capitals, punctuation, numbers, common transitions, contextual writing, endurance, and assessment. Four evidence-supported corrections were required:

1. New-key recap spacing was too wide inside the home, top, and bottom-row modules.
2. Capital letters introduced both Shift keys together instead of isolating each opposite-hand coordination first.
3. Guided transfer exercises generated valid words but did not reliably preserve a connected phrase.
4. Lesson controls were separated from the typing task and consumed too much of the first desktop viewport.

## Evidence used

- The official [KTouch course-authoring guidance](https://docs.kde.org/stable_kf6/en/ktouch/ktouch/extending.html) recommends home keys first, no more than two new keys in a lesson, heavy use of the new keys, a balanced repetition lesson after every two or three introductions, separate left-Shift/right-Shift/both-Shift steps, real words and sentences, and roughly 600–1200 characters per complete lesson.
- The official [KTouch efficient-training guidance](https://docs.kde.org/stable_kf6/en/ktouch/ktouch/efficient_training.html) prioritises steady rhythm and accuracy before speed. Its default next-lesson rule is intentionally strict at 98% accuracy with only a moderate speed requirement.
- The [GNU Typist manual](https://www.gnu.org/software/gtypist/doc/gtypist.html) recommends mixing drills with speed tests and placing practice-only work before a final test.
- The current [How To Type teacher guide](https://www.how-to-type.com/for-teachers/) uses technique drills followed by contextual practice, recommends repeating work below 95% accuracy, keeps the keyboard guide optional, and advises focused rather than speed-only assessment.
- The public [Keyboarding: A Teacher's Guide](https://files.eric.ed.gov/fulltext/ED278855.pdf) repeatedly combines warm-up, new-key location work, words, short sentences, and later speed drills while reviewing previously learned keys.
- Keith and Ericsson's typing study, [A deliberate practice account of typing proficiency in everyday typists](https://pubmed.ncbi.nlm.nih.gov/17924799/), found that typing-course experience and a goal of improving performance were associated with higher typing proficiency; general motor tapping ability was not.
- Crump and Logan's [Hierarchical control and skilled typing](https://www.crumplab.com/publications/Crump/files/4704/Crump%20and%20Logan%20-%202010%20-%20Hierarchical%20control%20and%20skilled%20typing%20Evidence.pdf) provides typing-specific evidence that skilled control operates at both the word and keystroke levels. This supports moving from isolated movements to real words and connected text instead of training only arbitrary character strings.
- Donica, Giroux, and Kim's [comparison of keyboarding instruction approaches](https://doi.org/10.15453/2168-6408.1599) found stronger speed and accuracy improvements for a structured, developmentally based curriculum than for free web activities in a large elementary-school sample.

## Course audit against the evidence

| Requirement | Result after correction |
| --- | --- |
| Start from F/J anchors and home position | Pass |
| Introduce at most two new movements at a time | Pass for lessons 1–17 |
| Make new keys frequent in guided, longer, and timed practice | Pass with explicit length-aware coverage floors |
| Balance paired keys rather than following ordinary English frequency alone | Pass |
| Recap all recently introduced keys every two to three introductions | Pass through six-key recap transfers at lessons 3, 9, and 15 plus full-row checkpoints at 6, 12, and 18 |
| Move from key pattern to words to transfer | Pass in every lesson through focus, control, and transfer stages |
| Preserve connected text during transfer | Pass from lesson 4 onward; the earliest restricted-key lessons retain deliberate movement patterns because meaningful sentences are not yet possible |
| Teach left Shift, right Shift, then both | Pass inside lesson 20 without changing its ID |
| Accuracy before speed | Pass; modern guided work requires 96% in focus and at least 95% in control/transfer, with no beginner WPM gate |
| Cumulative and spaced review | Pass through module reviews and the existing 3/7/14/30/60-day review schedule |
| Real-world transfer and endurance | Pass in lessons 24–27 |

## Content verification

The automated curriculum checks cover:

- all 27 lessons and all 81 guided exercises;
- longer-text selections at 100, 200, 300, and 500 words;
- timed selections at 1, 3, 5, and 10 minutes;
- allowed-character safety at every lesson;
- minimum exposure for letters, numbers, symbols, Shift, bigrams, and trigrams;
- pair and recap balance;
- fresh deterministic generation without immediate duplicate tokens;
- intact compatible words instead of words damaged by removing unavailable letters;
- opposite-hand Shift isolation;
- connected transfer anchors followed by varied generated material.

The 4,320-session long-text stress audit remains at zero invalid sessions. The normal regression suite additionally checks representative guided and timed generations on every project check.

## Deliberate limits

- Research and standard course manuals do not provide one universal percentage for every target key. The project's numerical exposure floors are transparent internal guardrails, not claimed as an external standard.
- The foundation course covers letters, numbers, Shift, common punctuation, email characters, practical text, and sustained writing. It does not pretend to be a full symbol-key course. A complete shifted-symbol extension should be a separate future module rather than overloading one existing lesson.
- WPM remains visible for feedback, but speed alone never unlocks a beginner lesson.
- The on-screen keyboard remains optional and collapsed by default so learners can request a cue without keeping their attention on a large keyboard diagram throughout practice.

## Learn-page UX correction

The lesson overview is now a compact orientation card. Exit, duration, technique, finger cue, and focus keys remain visible, while the mode, exercise, length/timer, and fresh-text controls now sit directly inside the typing workspace. This creates one local decision area immediately above the text and removes the large disconnected setup block shown in the previous desktop screen.

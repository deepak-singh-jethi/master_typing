import { cn } from "@/lib/utils";

const rows = [
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["Shift", "z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "Shift"],
  ["Space"],
];

const shiftedPhysicalKeys = {
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
};

const fingerMap = {
  "`": "Left pinky", "1": "Left pinky", q: "Left pinky", a: "Left pinky", z: "Left pinky",
  "2": "Left ring", w: "Left ring", s: "Left ring", x: "Left ring",
  "3": "Left middle", e: "Left middle", d: "Left middle", c: "Left middle",
  "4": "Left index", "5": "Left index", r: "Left index", t: "Left index", f: "Left index", g: "Left index", v: "Left index", b: "Left index",
  "6": "Right index", "7": "Right index", y: "Right index", u: "Right index", h: "Right index", j: "Right index", n: "Right index", m: "Right index",
  "8": "Right middle", i: "Right middle", k: "Right middle", ",": "Right middle",
  "9": "Right ring", o: "Right ring", l: "Right ring", ".": "Right ring",
  "0": "Right pinky", "-": "Right pinky", "=": "Right pinky", p: "Right pinky", "[": "Right pinky", "]": "Right pinky", "\\": "Right pinky", ";": "Right pinky", "'": "Right pinky", "/": "Right pinky",
  Space: "Thumb",
};

function getPhysicalKey(character) {
  if (!character) return "";
  if (character === " ") return "Space";
  if (character === "\n") return "Enter";
  if (shiftedPhysicalKeys[character]) return shiftedPhysicalKeys[character];
  return character.toLowerCase();
}

function needsShift(character) {
  return /[A-Z]/.test(character) || Boolean(shiftedPhysicalKeys[character]);
}

export function OnScreenKeyboard({ expectedCharacter, focusKeys = [], variant = "standard" }) {
  const physicalKey = getPhysicalKey(expectedCharacter);
  const shift = needsShift(expectedCharacter);
  const finger = fingerMap[physicalKey] ?? "Use the assigned finger";
  const lessonFocus = variant === "lesson-focus";
  const focusPhysicalKeys = new Set(focusKeys.map((key) => getPhysicalKey(key)));

  if (lessonFocus) {
    const keyboardRows = [
      [{ label: "~", key: "`" }, { label: "!", key: "1" }, { label: "@", key: "2" }, { label: "#", key: "3" }, { label: "$", key: "4" }, { label: "%", key: "5" }, { label: "^", key: "6" }, { label: "&", key: "7" }, { label: "*", key: "8" }, { label: "(", key: "9" }, { label: ")", key: "0" }, { label: "−", key: "-" }, { label: "+", key: "=" }, { label: "⌫", key: "Backspace", wide: "w-16" }],
      [{ label: "Tab", key: "Tab", wide: "w-16" }, ...["q","w","e","r","t","y","u","i","o","p","[","]","\\"].map((key) => ({ label: key.toUpperCase(), key }))],
      [{ label: "Caps", key: "Caps", wide: "w-[4.6rem]" }, ...["a","s","d","f","g","h","j","k","l",";","'"].map((key) => ({ label: key.toUpperCase(), key })), { label: "Enter", key: "Enter", wide: "w-[4.8rem]" }],
      [{ label: "Shift", key: "Shift", wide: "w-24" }, ...["z","x","c","v","b","n","m",",",".","/"].map((key) => ({ label: key.toUpperCase(), key })), { label: "Shift", key: "Shift", wide: "w-24" }],
      [{ label: "Space", key: "Space", wide: "w-[34rem]" }],
    ];

    return (
      <section aria-hidden="true" className="hidden sm:block">
        <div className="mx-auto max-w-5xl space-y-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {keyboardRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex min-w-[760px] justify-center gap-1.5">
              {row.map((item, keyIndex) => {
                const active = item.key === physicalKey || (item.key === "Shift" && shift);
                const focus = focusPhysicalKeys.has(item.key);
                return (
                  <div
                    key={`${item.key}-${keyIndex}`}
                    className={cn(
                      "grid h-10 min-w-11 place-items-center rounded-lg border border-slate-200 bg-slate-100 px-2 font-sans text-xs font-medium text-slate-600 shadow-[inset_0_-1px_0_rgba(15,23,42,0.08)] transition dark:border-slate-800 dark:bg-[#111b2a] dark:text-slate-300 dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]",
                      item.wide,
                      focus && "border-violet-500/60 bg-violet-600 text-white shadow-[0_0_18px_rgba(124,58,237,0.16)] dark:bg-violet-600 dark:text-white",
                      active && !focus && "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/15 dark:text-indigo-200",
                      active && focus && "ring-2 ring-violet-300/50 dark:ring-violet-400/35",
                    )}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-hidden="true" className="hidden rounded-3xl border border-slate-200 bg-white p-4 sm:block dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Next key</p>
          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
            {expectedCharacter === " " ? "Space" : expectedCharacter || "—"}
            {expectedCharacter && <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">· {finger}</span>}
          </p>
        </div>
        <p className="hidden text-xs text-slate-400 sm:block">Keep your eyes on the text</p>
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto min-w-[660px] max-w-4xl space-y-1.5">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1.5">
              {row.map((key, keyIndex) => {
                const active = key === physicalKey || (key === "Shift" && shift);
                const isSpace = key === "Space";
                const isShift = key === "Shift";
                return (
                  <div
                    key={`${key}-${keyIndex}`}
                    className={cn(
                      "grid h-10 min-w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 px-2 font-mono text-xs font-semibold text-slate-500 shadow-[0_2px_0_rgb(226,232,240)] transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:shadow-[0_2px_0_rgb(30,41,59)]",
                      isSpace && "w-64",
                      isShift && "w-20",
                      active && "translate-y-[1px] border-indigo-500 bg-indigo-600 text-white shadow-none dark:border-indigo-400 dark:bg-indigo-500",
                    )}
                  >
                    {key}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

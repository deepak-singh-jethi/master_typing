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

export function OnScreenKeyboard({ expectedCharacter }) {
  const physicalKey = getPhysicalKey(expectedCharacter);
  const shift = needsShift(expectedCharacter);
  const finger = fingerMap[physicalKey] ?? "Use the assigned finger";

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

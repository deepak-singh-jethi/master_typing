import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { getActiveWordRange, getTypingWindow } from "@/lib/typingWindow";

const sizeClasses = {
  small: "text-[1.05rem] leading-[1.85] sm:text-[1.2rem]",
  medium: "text-[1.2rem] leading-[1.8] sm:text-[1.5rem]",
  large: "text-[1.4rem] leading-[1.8] sm:text-[1.78rem]",
};

export function TypingText({ target, typed, textSize = "medium", caretStyle = "bar", variant = "standard" }) {
  const activeRef = useRef(null);
  const currentIndex = typed.length;
  const activeWordRange = useMemo(() => getActiveWordRange(target, currentIndex), [currentIndex, target]);
  const windowed = useMemo(() => getTypingWindow(target, currentIndex), [currentIndex, target]);
  const currentWordStartRef = useRef(activeWordRange.start);
  const currentWord = target.slice(activeWordRange.start, activeWordRange.end).trim() || "space";

  useEffect(() => {
    if (currentWordStartRef.current === activeWordRange.start) return;
    currentWordStartRef.current = activeWordRange.start;
    activeRef.current?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
  }, [activeWordRange.start]);

  const lessonFocus = variant === "lesson-focus";

  return (
    <div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">Typing passage. Current word: {currentWord}.</p>
      <div
        aria-hidden="true"
        className={cn(
          lessonFocus
            ? "max-h-[19rem] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[1.55rem] leading-[1.9] tracking-[0.01em] [scrollbar-width:none] sm:max-h-[21rem] sm:text-[1.8rem] lg:max-h-[22rem] lg:text-[2rem] [&::-webkit-scrollbar]:hidden"
            : "max-h-[15rem] overflow-y-auto whitespace-pre-wrap break-words font-mono tracking-[0.01em] [scrollbar-width:none] sm:max-h-[17rem] lg:max-h-[18rem] [&::-webkit-scrollbar]:hidden",
          !lessonFocus && (sizeClasses[textSize] ?? sizeClasses.medium),
        )}
        data-rendered-characters={windowed.text.length}
        data-total-characters={target.length}
      >
        {windowed.hiddenBefore > 0 && <span className="mr-2 text-xs font-sans text-slate-300 dark:text-slate-700">…</span>}
        {windowed.text.split("").map((character, localIndex) => {
          const index = windowed.start + localIndex;
          const isTyped = index < typed.length;
          const isCorrect = isTyped && typed[index] === character;
          const isIncorrect = isTyped && !isCorrect;
          const isCurrent = index === currentIndex;
          const isCurrentWord = index >= activeWordRange.start && index < activeWordRange.end;
          const displayCharacter = character === "\n" ? "↵\n" : character;
          return (
            <span
              key={`${index}-${character}`}
              ref={isCurrent ? activeRef : null}
              className={cn(
                "relative rounded-[0.22em] transition-colors duration-100",
                !isTyped && (lessonFocus ? "text-slate-400/80 dark:text-slate-500" : "text-slate-400/75 dark:text-slate-500"),
                !isTyped && isCurrentWord && !lessonFocus && "bg-indigo-50/80 dark:bg-indigo-500/5",
                isCorrect && (lessonFocus ? "text-slate-950 dark:text-slate-100" : "text-slate-950 dark:text-slate-100"),
                isIncorrect && "bg-rose-100 text-rose-700 underline decoration-rose-500 decoration-2 dark:bg-rose-500/15 dark:text-rose-300",
                isCurrent && caretStyle === "block" && (lessonFocus ? "bg-violet-600 text-white shadow-[0_0_18px_rgba(124,58,237,0.28)]" : "bg-indigo-600 text-white"),
                isCurrent && caretStyle === "underline" && (lessonFocus ? "border-b-2 border-violet-500" : "border-b-2 border-indigo-600"),
                isCurrent && caretStyle === "bar" && (lessonFocus
                  ? "before:absolute before:-left-[1px] before:top-[0.12em] before:h-[1.25em] before:w-[3px] before:animate-pulse before:rounded-full before:bg-violet-500 before:shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                  : "before:absolute before:-left-[1px] before:top-[0.12em] before:h-[1.25em] before:w-[2px] before:animate-pulse before:rounded-full before:bg-indigo-600"),
              )}
            >
              {isIncorrect && character === " " ? "␣" : displayCharacter}
            </span>
          );
        })}
        {windowed.hiddenAfter > 0 && <span className="ml-2 text-xs font-sans text-slate-300 dark:text-slate-700">…</span>}
      </div>
    </div>
  );
}

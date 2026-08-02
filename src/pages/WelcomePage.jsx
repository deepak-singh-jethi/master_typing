import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, Keyboard, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Logo } from "@/components/layout/Logo";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";

const experienceOptions = [
  { value: "beginner", title: "Learning from the beginning", description: "Start with finger placement and guided lessons." },
  { value: "hunt-and-peck", title: "I type while looking at the keyboard", description: "Rebuild technique and keep your eyes on the screen." },
  { value: "touch-typist", title: "I already touch type", description: "Use a diagnostic, adaptive practice, and benchmarks." },
];

const goalOptions = [
  { value: "accuracy", title: "Accuracy", icon: ShieldCheck, description: "Reduce mistakes and build reliable movement." },
  { value: "speed", title: "Speed", icon: Target, description: "Increase WPM after technique is stable." },
  { value: "work", title: "Practical typing", icon: Keyboard, description: "Improve forms, emails, notes, and office text." },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const { data, finishOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(data.profile.name === "Learner" ? "" : data.profile.name);
  const [experience, setExperience] = useState(data.profile.experience || "beginner");
  const [primaryGoal, setPrimaryGoal] = useState(data.profile.primaryGoal || "accuracy");
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(data.settings.dailyGoalMinutes || 15);

  const save = (takeDiagnostic = false) => {
    finishOnboarding({
      profile: { name: name.trim() || "Learner", experience, primaryGoal },
      settings: { dailyGoalMinutes },
    });
    navigate(takeDiagnostic ? "/diagnostic" : "/learn/home-f-j");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <button type="button" onClick={() => save(false)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white">
            Skip setup
          </button>
        </div>

        <header className="mt-8 sm:mt-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
            <span>Step {step} of 2</span>
            <span aria-hidden="true">·</span>
            <span>{step === 1 ? "Your starting point" : "Your practice goal"}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2" aria-label={`Setup progress: step ${step} of 2`}>
            <span className="h-1.5 rounded-full bg-indigo-600" />
            <span className={cn("h-1.5 rounded-full", step === 2 ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-800")} />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl dark:text-white">
            {step === 1 ? "Start at the right level." : "Choose a goal you can sustain."}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-400">
            {step === 1
              ? "A few simple choices help the app avoid lessons that are too easy or too advanced."
              : "Short, regular sessions work better than occasional long sessions. You can change this later."}
          </p>
        </header>

        <Card className="mt-7 p-5 sm:p-7">
          {step === 1 ? (
            <div className="space-y-7">
              <div>
                <label htmlFor="name" className="text-sm font-semibold text-slate-950 dark:text-white">Your name</label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Used only to personalise the interface.</p>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-slate-950 dark:text-white">How do you type today?</legend>
                <div className="mt-3 grid gap-3">
                  {experienceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={experience === option.value}
                      onClick={() => setExperience(option.value)}
                      className={cn(
                        "flex min-h-20 items-start gap-3 rounded-2xl border p-4 text-left transition",
                        experience === option.value
                          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-950/40",
                      )}
                    >
                      <span className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border",
                        experience === option.value ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-600",
                      )}>{experience === option.value && <Check className="size-3.5" aria-hidden="true" />}</span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-950 dark:text-white">{option.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : (
            <div className="space-y-7">
              <fieldset>
                <legend className="text-sm font-semibold text-slate-950 dark:text-white">Main goal</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {goalOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={primaryGoal === option.value}
                      onClick={() => setPrimaryGoal(option.value)}
                      className={cn(
                        "min-h-36 rounded-2xl border p-4 text-left transition",
                        primaryGoal === option.value
                          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-950/40",
                      )}
                    >
                      <option.icon className={cn("size-5", primaryGoal === option.value ? "text-indigo-600" : "text-slate-400")} aria-hidden="true" />
                      <span className="mt-3 block text-sm font-semibold text-slate-950 dark:text-white">{option.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <legend className="text-sm font-semibold text-slate-950 dark:text-white">Daily practice goal</legend>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Most learners should start with 10 or 15 minutes.</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Clock3 className="size-4" aria-hidden="true" />{dailyGoalMinutes} min
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={dailyGoalMinutes === minutes}
                      onClick={() => setDailyGoalMinutes(minutes)}
                      className={cn(
                        "min-h-11 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
                        dailyGoalMinutes === minutes
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                      )}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between dark:border-slate-800">
            {step === 2 ? (
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>
            ) : <span />}
            {step === 1 ? (
              <Button variant="brand" onClick={() => setStep(2)} className="sm:min-w-36">Continue<ArrowRight className="size-4" aria-hidden="true" /></Button>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="secondary" onClick={() => save(false)}>Start from lesson 1</Button>
                <Button variant="brand" onClick={() => save(true)}>Take 2-minute diagnostic<ArrowRight className="size-4" aria-hidden="true" /></Button>
              </div>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-xs leading-5 text-slate-400">Guest progress stays on this device until you create an account.</p>
      </div>
    </div>
  );
}

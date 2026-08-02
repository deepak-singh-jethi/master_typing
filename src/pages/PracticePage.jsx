import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenText,
  Check,
  ChevronDown,
  Gauge,
  Hash,
  Keyboard,
  Save,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { useApp } from "@/hooks/useApp";
import {
  categoryOptions,
  contentTypeOptions,
  practicePresets,
} from "@/data/practicePresets";
import {
  getPurposeOptions,
  normalisePracticeConfig,
} from "@/lib/practiceRecipes";
import { cn } from "@/lib/utils";

const timeOptions = [60, 120, 180, 300, 600, 900, 1200];
const wordOptions = [25, 50, 100, 200, 500];
const documentStyleOptions = [
  { value: "mixed", label: "Mixed practical", description: "A varied blend of emails, forms, notices, reports, and data entry." },
  { value: "everyday", label: "Everyday", description: "Appointments, reminders, addresses, and practical records." },
  { value: "email", label: "Office email", description: "Messages, updates, meeting notes, and project reports." },
  { value: "forms", label: "Forms and data", description: "Names, dates, references, amounts, and verification fields." },
  { value: "study", label: "Study documents", description: "Revision plans, summaries, assessments, and research notes." },
  { value: "government", label: "Government", description: "Notifications, applications, records, and committee briefs." },
  { value: "technology", label: "Technology", description: "Release notes, support updates, checks, and issue reports." },
];

const densityOptions = [
  { value: 0.25, label: "Light", description: "Mild weighting toward saved target patterns" },
  { value: 0.4, label: "Focused", description: "Frequent targeting with natural filler" },
  { value: 0.58, label: "Intensive", description: "Heavy weighting for a short correction session" },
];

export function PracticePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    data,
    saveLastPracticeConfig,
    saveCustomText,
    deleteCustomText,
  } = useApp();
  const [config, setConfig] = useState(() => normalisePracticeConfig(data.lastPracticeConfig));
  const [customTitle, setCustomTitle] = useState("");
  const [selectedSavedTextId, setSelectedSavedTextId] = useState("");
  const [customTextNotice, setCustomTextNotice] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMorePresets, setShowMorePresets] = useState(false);
  const [showBuilder, setShowBuilder] = useState(() => Boolean(location.state?.openBuilder));
  const purposeOptions = getPurposeOptions();

  const updateConfig = (updates) => {
    setConfig((current) => normalisePracticeConfig({
      ...current,
      ...updates,
      presetId: null,
      accuracyTarget: null,
    }));
  };

  const choosePurpose = (purpose) => {
    const updates = { purpose };
    if (purpose === "speed") Object.assign(updates, { contentType: "words", difficulty: "easy", goalType: "time", durationSeconds: 60 });
    if (purpose === "endurance") Object.assign(updates, { contentType: "paragraphs", goalType: "time", durationSeconds: Math.max(config.durationSeconds, 300) });
    if (purpose === "accuracy") Object.assign(updates, { difficulty: "easy" });
    if (purpose === "adaptive") Object.assign(updates, { contentType: "words", difficulty: "adaptive", targetDensity: 0.4 });
    updateConfig(updates);
  };

  const startSession = (nextConfig = config) => {
    const finalConfig = normalisePracticeConfig({ ...nextConfig, seed: Date.now() });
    saveLastPracticeConfig(finalConfig);
    navigate("/practice/session", { state: { config: finalConfig } });
  };

  const customText = String(config.customText || "");
  const canStart = config.contentType !== "custom" || customText.trim().length >= 20;
  const customTime = !timeOptions.includes(config.durationSeconds);
  const customWords = !wordOptions.includes(config.wordCount);
  const sessionLabel = useMemo(() => {
    const content = contentTypeOptions.find((item) => item.value === config.contentType)?.label ?? "Practice";
    const purpose = purposeOptions.find((item) => item.value === config.purpose)?.label ?? "Balanced";
    const goal = config.goalType === "time"
      ? `${formatMinutes(config.durationSeconds)}`
      : `${config.wordCount} words`;
    return `${purpose} · ${content} · ${goal}`;
  }, [config, purposeOptions]);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <PageHeader
        eyebrow="Practice"
        title="What would you like to practise?"
        description="Pick a ready-made session. You can customise the details only when you need to."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {practicePresets.slice(0, 4).map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            onStart={() => startSession({ ...data.lastPracticeConfig, ...preset.config, presetId: preset.id })}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={() => setShowBuilder((current) => !current)} aria-expanded={showBuilder} aria-controls="custom-session-builder">
          <SlidersHorizontal className="size-4" />{showBuilder ? "Close custom setup" : "Create a custom session"}
        </Button>
        <Button variant="ghost" onClick={() => setShowMorePresets((current) => !current)} aria-expanded={showMorePresets} aria-controls="more-practice-presets">
          {showMorePresets ? "Hide more guided sessions" : "Show more guided sessions"}
          <ChevronDown className={cn("size-4 transition", showMorePresets && "rotate-180")} />
        </Button>
      </div>

      {showMorePresets && (
        <div id="more-practice-presets" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {practicePresets.slice(4).map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onStart={() => startSession({ ...data.lastPracticeConfig, ...preset.config, presetId: preset.id })}
            />
          ))}
        </div>
      )}

      {showBuilder && <div id="custom-session-builder" className="mx-auto grid max-w-3xl gap-6">
        <Card className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">Custom session</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Choose what you want to improve</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Pick a purpose, content type, and session length. Advanced controls stay hidden until you need them.</p>
            </div>
            <span className="hidden max-w-xs rounded-xl bg-slate-100 px-3 py-2 text-right text-xs font-semibold text-slate-500 sm:inline-flex dark:bg-slate-800 dark:text-slate-300">{sessionLabel}</span>
          </div>

          <div className="mt-7 space-y-7">
            <Field label="Practice purpose" description="Choose the learning outcome before choosing the text.">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {purposeOptions.map((option) => (
                  <OptionCard
                    key={option.value}
                    active={config.purpose === option.value}
                    title={option.label}
                    description={option.description}
                    onClick={() => choosePurpose(option.value)}
                  />
                ))}
              </div>
            </Field>

            <Field label="Content type" description="The same purpose can be trained through words, natural writing, figures, or your own material.">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {contentTypeOptions.map((option) => (
                  <OptionCard
                    key={option.value}
                    active={config.contentType === option.value}
                    title={option.label}
                    description={option.description}
                    onClick={() => updateConfig({ contentType: option.value })}
                  />
                ))}
              </div>
            </Field>

            {config.contentType === "custom" && (
              <Field label="Your text" description="Paste notes, an article, an email, or any material you genuinely need to type.">
                <textarea
                  value={customText}
                  onChange={(event) => {
                    updateConfig({ customText: event.target.value.slice(0, 12000) });
                    setCustomTextNotice("");
                  }}
                  placeholder="Paste at least 20 characters..."
                  aria-label="Custom practice text"
                  aria-describedby="custom-text-help"
                  className="min-h-48 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <div id="custom-text-help" className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{customText.trim().split(/\s+/).filter(Boolean).length} words</span>
                  <span className={cn(customText.trim().length > 0 && customText.trim().length < 20 && "font-semibold text-amber-600 dark:text-amber-300")}>
                    {customText.trim().length > 0 && customText.trim().length < 20
                      ? `${20 - customText.trim().length} more characters needed`
                      : `${customText.length}/12,000 characters`}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-950 dark:text-white">Save or reuse practice text</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Saved text stays available on this device and syncs with your account.</p>
                    </div>
                    <Save className="size-4 shrink-0 text-indigo-500" aria-hidden="true" />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={customTitle}
                      onChange={(event) => { setCustomTitle(event.target.value.slice(0, 120)); setCustomTextNotice(""); }}
                      placeholder="Name this text (optional)"
                      aria-label="Saved text title"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={customText.trim().length < 20}
                      onClick={() => {
                        saveCustomText(customTitle, customText);
                        setCustomTitle("");
                        setCustomTextNotice("Text saved.");
                      }}
                    >
                      <Save className="size-4" aria-hidden="true" />Save
                    </Button>
                  </div>

                  {data.savedCustomTexts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select
                        value={selectedSavedTextId}
                        onChange={(event) => { setSelectedSavedTextId(event.target.value); setCustomTextNotice(""); }}
                        aria-label="Choose saved practice text"
                        className="h-10 min-w-52 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="">Choose saved text</option>
                        {data.savedCustomTexts.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!selectedSavedTextId}
                        onClick={() => {
                          const selected = data.savedCustomTexts.find((item) => item.id === selectedSavedTextId);
                          if (!selected) return;
                          updateConfig({ contentType: "custom", customText: selected.text });
                          setCustomTitle(selected.title);
                          setCustomTextNotice(`Loaded “${selected.title}”.`);
                        }}
                      >Load</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!selectedSavedTextId}
                        aria-label="Delete selected saved text"
                        onClick={() => {
                          deleteCustomText(selectedSavedTextId);
                          setSelectedSavedTextId("");
                          setCustomTextNotice("Saved text deleted.");
                        }}
                      ><Trash2 className="size-4" aria-hidden="true" />Delete</Button>
                    </div>
                  )}
                  {customTextNotice && <p role="status" aria-live="polite" className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">{customTextNotice}</p>}
                </div>
              </Field>
            )}

            <Field label="Session goal" description="Timed practice builds rhythm; word-count practice requires full completion.">
              <SegmentedControl
                value={config.goalType}
                onChange={(value) => updateConfig({ goalType: value })}
                options={[{ value: "time", label: "Time" }, { value: "words", label: "Word count" }]}
                label="Session goal"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {(config.goalType === "time" ? timeOptions : wordOptions).map((value) => {
                  const active = config.goalType === "time" ? config.durationSeconds === value : config.wordCount === value;
                  return (
                    <ChoiceButton
                      key={value}
                      active={active}
                      onClick={() => updateConfig(config.goalType === "time" ? { durationSeconds: value } : { wordCount: value })}
                    >
                      {config.goalType === "time" ? formatMinutes(value) : `${value} words`}
                    </ChoiceButton>
                  );
                })}
                <ChoiceButton
                  active={config.goalType === "time" ? customTime : customWords}
                  onClick={() => updateConfig(config.goalType === "time" ? { durationSeconds: 240 } : { wordCount: 150 })}
                >
                  Custom
                </ChoiceButton>
              </div>
              {config.goalType === "time" && customTime && (
                <CustomNumberInput
                  key={`time-${config.durationSeconds}`}
                  value={config.durationSeconds / 60}
                  min={1}
                  max={60}
                  step={1}
                  suffix="minutes"
                  onCommit={(value) => updateConfig({ durationSeconds: value * 60 })}
                />
              )}
              {config.goalType === "words" && customWords && (
                <CustomNumberInput
                  key={`words-${config.wordCount}`}
                  value={config.wordCount}
                  min={10}
                  max={5000}
                  step={10}
                  suffix="words"
                  onCommit={(value) => updateConfig({ wordCount: value })}
                />
              )}
            </Field>

            <button
              type="button"
              aria-expanded={showAdvanced}
              aria-controls="advanced-practice-controls"
              onClick={() => setShowAdvanced((current) => !current)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-indigo-500/40"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300"><SlidersHorizontal className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-950 dark:text-white">Advanced controls</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Category, difficulty, adaptive density, document style, capitals, punctuation, and numbers.</span>
              </span>
              <ChevronDown className={cn("size-4 text-slate-400 transition", showAdvanced && "rotate-180")} />
            </button>

            {showAdvanced && (
              <div id="advanced-practice-controls" className="space-y-7 rounded-[1.6rem] border border-slate-200 bg-slate-50/60 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-950/40">
                {!['numbers', 'custom'].includes(config.contentType) && (
                  <Field label="Vocabulary category" description="Use language close to the work you actually type.">
                    <div className="relative">
                      <select
                        value={config.category}
                        onChange={(event) => updateConfig({ category: event.target.value })}
                        className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-4 size-4 text-slate-400" />
                    </div>
                  </Field>
                )}

                {config.contentType === "documents" && (
                  <Field label="Document style" description="Each style uses a separate practical template and vocabulary system.">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {documentStyleOptions.map((option) => (
                        <OptionCard
                          key={option.value}
                          active={config.documentStyle === option.value}
                          title={option.label}
                          description={option.description}
                          onClick={() => updateConfig({ documentStyle: option.value, progressiveFeatures: true })}
                        />
                      ))}
                    </div>
                  </Field>
                )}

                {!['numbers', 'custom'].includes(config.contentType) && (
                  <Field label="Difficulty" description="Difficulty uses frequency, same-finger movement, hand balance, repeated letters, uncommon pairs, and keyboard travel.">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[["easy", "Easy"], ["balanced", "Balanced"], ["hard", "Challenging"], ["adaptive", "Adaptive"]].map(([value, label]) => (
                        <ChoiceButton key={value} active={config.difficulty === value} onClick={() => updateConfig({ difficulty: value })}>{label}</ChoiceButton>
                      ))}
                    </div>
                  </Field>
                )}

                {['adaptive', 'recovery'].includes(config.purpose) && (
                  <Field label="Target concentration" description="Controls how strongly saved weak patterns influence selection.">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {densityOptions.map((option) => (
                        <OptionCard
                          key={option.value}
                          active={Math.abs(config.targetDensity - option.value) < 0.02}
                          title={option.label}
                          description={option.description}
                          onClick={() => updateConfig({ targetDensity: option.value })}
                        />
                      ))}
                    </div>
                  </Field>
                )}

                {config.contentType === "words" && (
                  <Field label="Text features" description="Add complexity only when normal letter typing feels stable.">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <FeatureToggle icon={TrendingUp} label="Adaptive progression" active={config.progressiveFeatures} onClick={() => updateConfig({ progressiveFeatures: !config.progressiveFeatures })} />
                      <FeatureToggle icon={BookOpenText} label="Punctuation" active={config.punctuation} onClick={() => updateConfig({ punctuation: !config.punctuation })} />
                      <FeatureToggle icon={Keyboard} label="Capital letters" active={config.capitals} onClick={() => updateConfig({ capitals: !config.capitals })} />
                      <FeatureToggle icon={Hash} label="Numbers" active={config.numbers} onClick={() => updateConfig({ numbers: !config.numbers })} />
                    </div>
                  </Field>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{sessionLabel}</span>
              <span className="mx-2">·</span>
              Fresh text excludes recent matching material when possible
            </div>
            <Button variant="brand" size="lg" disabled={!canStart} onClick={() => startSession()}>
              <Gauge className="size-4" />Build and start<ArrowRight className="size-4" />
            </Button>
          </div>
        </Card>

      </div>}
    </div>
  );
}

function formatMinutes(seconds) {
  const minutes = Number(seconds) / 60;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

function PresetCard({ preset, onStart }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="group rounded-[1.6rem] border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40 dark:hover:shadow-none"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/10 dark:text-indigo-300">
        <preset.icon className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold text-slate-950 dark:text-white">{preset.title}</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{preset.description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">Quick start<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" /></div>
    </button>
  );
}

function CustomNumberInput({ value, min, max, step, suffix, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const next = Math.min(max, Math.max(min, Number(draft) || min));
    setDraft(String(next));
    onCommit(next);
  };
  return (
    <label className="mt-3 flex max-w-xs items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-white"
      />
      <span className="text-xs font-semibold text-slate-400">{suffix}</span>
    </label>
  );
}

function Field({ label, description, children }) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{label}</p>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function OptionCard({ active, title, description, onClick }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("relative rounded-2xl border p-3.5 text-left transition", active ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700")}>
      {active && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-indigo-600 text-white"><Check className="size-3" /></span>}
      <p className="pr-6 text-xs font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{description}</p>
    </button>
  );
}

function ChoiceButton({ active, onClick, children }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("rounded-xl border px-3 py-2 text-xs font-semibold transition", active ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")}>{children}</button>;
}

function FeatureToggle({ icon: Icon, label, active, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={active} onClick={onClick} className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left transition", active ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300")}>
      <Icon className="size-4" /><span className="text-xs font-semibold">{label}</span>
      <span className={cn("ml-auto h-5 w-9 rounded-full p-0.5 transition", active ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700")}><span className={cn("block size-4 rounded-full bg-white transition", active && "translate-x-4")} /></span>
    </button>
  );
}

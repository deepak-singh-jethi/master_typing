import { Component } from "react";
import { TriangleAlert } from "lucide-react";
import { BUILD_ID } from "@/lib/release.js";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Typing Master UI error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div role="alert" className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-500/25 dark:bg-slate-900">
          <span className="grid size-12 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <TriangleAlert className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">This screen could not load</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Your saved progress has not been deleted. Reload the app first; return to Today if the same screen fails again.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Reload app
            </button>
            <a
              href="#/"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Return to Today
            </a>
          </div>
          <details className="mt-5 text-xs text-slate-400">
            <summary className="cursor-pointer font-semibold">Technical details</summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-3 dark:bg-slate-950">{String(this.state.error?.message || this.state.error)}</pre>
            <p className="mt-2">Build {BUILD_ID}</p>
          </details>
        </div>
      </main>
    );
  }
}

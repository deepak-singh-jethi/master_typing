import { Keyboard } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-3", className)}>
      <span className="grid size-10 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
        <Keyboard className="size-5" />
      </span>
      {!compact && (
        <span>
          <span className="block text-sm font-bold tracking-tight text-slate-950 dark:text-white">Typing Master</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Learn with purpose</span>
        </span>
      )}
    </Link>
  );
}

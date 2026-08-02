import { Link } from "react-router-dom";
import { ArrowLeft, Keyboard } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";

export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center sm:p-10">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"><Keyboard className="size-6" /></span>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">This page is not part of the course.</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Return to the dashboard and continue from your saved local progress.</p>
      <Button as={Link} to="/" variant="brand" className="mt-6"><ArrowLeft className="size-4" />Back to dashboard</Button>
    </Card>
  );
}

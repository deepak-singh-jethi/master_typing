import { cn } from "@/lib/utils";

export function Card({ as: Component = "div", className, children, ...props }) {
  return (
    <Component
      className={cn(
        "rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.035)] dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ className, children }) {
  return <div className={cn("p-5 sm:p-6", className)}>{children}</div>;
}

export function CardTitle({ as: Component = "h2", className, children }) {
  return <Component className={cn("text-base font-semibold tracking-tight text-slate-950 dark:text-white", className)}>{children}</Component>;
}

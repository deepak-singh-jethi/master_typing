import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-slate-950 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200",
  brand: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 active:bg-indigo-700",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700",
};

const sizes = {
  sm: "min-h-9 rounded-xl px-3 text-xs",
  md: "min-h-11 rounded-2xl px-4 text-sm",
  lg: "min-h-12 rounded-2xl px-5 text-sm",
  icon: "size-11 rounded-xl",
};

export const Button = forwardRef(function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className,
  children,
  type,
  ...props
}, ref) {
  const componentProps = Component === "button" ? { type: type || "button" } : {};

  return (
    <Component
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...componentProps}
      {...props}
    >
      {children}
    </Component>
  );
});

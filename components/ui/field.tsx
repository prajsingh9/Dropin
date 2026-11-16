import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block px-1 text-[13px] font-semibold text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="px-1 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="px-1 text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const base =
  "w-full rounded-2xl bg-surface-2 px-4 text-[15px] font-medium text-fg placeholder:text-muted/70 outline-none ring-1 ring-inset ring-transparent transition focus:bg-surface focus:ring-accent aria-[invalid=true]:ring-danger disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(base, "h-13 min-h-[52px]", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(base, "h-13 min-h-[52px] appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10", className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")" }} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-28 py-3.5", className)} {...props} />;
});

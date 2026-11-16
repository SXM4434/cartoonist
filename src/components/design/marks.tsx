import { cn } from "@/lib/utils";

export function Marks({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none", className)} viewBox="0 0 180 54" fill="none">
      <path d="M4 31c31-13 66-16 101-11 26 4 47 12 70 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M9 40c38-9 80-11 116-6 15 2 30 6 45 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".62" />
    </svg>
  );
}
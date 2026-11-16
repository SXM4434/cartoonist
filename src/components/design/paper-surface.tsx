import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function PaperSurface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("paper-surface", className)} {...props} />;
}
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function DimensionalHeading({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={cn("dimensional-heading font-display", className)} data-text={typeof children === "string" ? children : undefined} {...props}>
      {children}
    </h1>
  );
}
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Prumo's mark: a plumb line (a bar, the string and the weight). Drawn with
 * currentColor so it follows the text color in both themes. Decorative: the
 * name next to it is what screen readers announce.
 */
export function BrandMark({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-5", className)}
      {...props}
    >
      <path d="M7 3h10" />
      <path d="M12 3v11" />
      <path d="M12 14l-3.5 3.5L12 21l3.5-3.5z" fill="currentColor" />
    </svg>
  );
}

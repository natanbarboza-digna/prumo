"use client"

import * as React from "react"
import { cn } from "cn"
import { Progress as ProgressPrimitive } from "radix-ui"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-primary/15",
        className
      )}
      // Local fix: pass value to Radix so it sets aria-valuenow (the upstream
      // component only used it for the bar width, leaving screen readers
      // without the percentage).
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        // Local change: a complete bar turns "done" green.
        className={cn(
          "h-full w-full flex-1 transition-all",
          value === 100 ? "bg-success" : "bg-primary"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }

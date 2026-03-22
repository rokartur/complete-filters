import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  trackClassName?: string
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, trackClassName, indicatorClassName, ...props }, ref) => {
    const safeMax = max > 0 ? max : 100
    const percentage = Math.min(Math.max((value / safeMax) * 100, 0), 100)

    return (
    <ProgressPrimitive.Root
      ref={ref}
      value={value}
      max={max}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full border border-border/70 bg-muted/60",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Track className={cn("h-full w-full rounded-full", trackClassName)}>
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full rounded-full bg-white",
            indicatorClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }

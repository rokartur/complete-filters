import * as React from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/* ── Root ── */
interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple"
  defaultValue?: string[]
  children: React.ReactNode
}

function Accordion({ type = "multiple", defaultValue = [], className, children, ...props }: AccordionProps) {
  return (
    <AccordionPrimitive.Root
      defaultValue={defaultValue}
      className={cn("w-full", className)}
      {...props}
    >
      {children}
    </AccordionPrimitive.Root>
  )
}

/* ── Item ── */
interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, ...props }, ref) => (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn("border-b", className)}
      {...props}
    />
  )
)
AccordionItem.displayName = "AccordionItem"

/* ── Trigger ── */
interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Header className="flex w-full">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex w-full flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline text-left cursor-pointer [&[data-panel-open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="accordion-chevron h-4 w-4 shrink-0 text-muted-foreground" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
)
AccordionTrigger.displayName = "AccordionTrigger"

/* ── Content ── */
interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Panel
      ref={ref}
      keepMounted
      className="accordion-panel overflow-hidden text-sm"
      {...props}
    >
      <div className={cn("accordion-panel-content pb-4 pt-0", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
)
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }

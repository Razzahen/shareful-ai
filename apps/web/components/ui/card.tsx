import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-2xl text-card-foreground", {
  variants: {
    variant: {
      default:
        "bg-card shadow-foreground/5 shadow-lg ring-1 ring-foreground/6.5 dark:shadow-black/10",
      soft: "bg-muted",
      mixed: "border bg-muted",
      outline: "bg-card ring-1 ring-border",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      className={cn(cardVariants({ variant, className }))}
      ref={ref}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      ref={ref}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cn("font-semibold leading-none tracking-tight", className)}
      ref={ref}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn("text-muted-foreground text-sm", className)}
    ref={ref}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn("p-6 pt-0", className)} ref={ref} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cn("flex items-center p-6 pt-0", className)}
      ref={ref}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};

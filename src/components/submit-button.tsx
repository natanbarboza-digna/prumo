"use client";
// Client Component: useFormStatus reads, in the browser, whether the <form>
// around this button is still waiting for its Server Action.

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  /** Shown while the action runs; defaults to the normal content. */
  pendingContent?: ReactNode;
};

export function SubmitButton({ children, pendingContent, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-disabled={pending} {...props}>
      {pending && pendingContent ? pendingContent : children}
    </Button>
  );
}

"use client";
// A custom hook (a function starting with "use" that calls React hooks) with
// everything our forms share: browser-side validation with the same Zod schema
// the server uses, field errors, focus on the first invalid field, unique ids,
// and the cleanup Next's hidden pages (Activity) need.

import {
  type FormEvent,
  useActionState,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";

/** What every form Server Action returns when it does not redirect. */
export type FormState<Values> = {
  errors?: Partial<Record<keyof Values, string[]>>;
  formError?: string;
  /** What was typed, so the form can show it again after a server-side error. */
  values?: Values;
};

type Options<Values extends Record<string, unknown>> = {
  schema: z.ZodType<unknown, Values>;
  action: (state: FormState<Values>, formData: FormData) => Promise<FormState<Values>>;
  defaultValues: Values;
  /** Field names in screen order, used to focus the first invalid one. */
  fieldOrder: readonly (keyof Values & string)[];
  /**
   * Turns the submitted FormData into the values the schema checks. The default
   * keeps one value per name, so forms with repeated names (a group of
   * checkboxes) pass their own reader.
   */
  readForm?: (formData: FormData) => unknown;
};

export function useSchemaForm<Values extends Record<string, unknown>>({
  schema,
  action,
  defaultValues,
  fieldOrder,
  readForm = (formData) => Object.fromEntries(formData),
}: Options<Values>) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<FormState<Values>["errors"] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  // Next keeps recently visited pages in the DOM (hidden), so the same form can
  // exist twice at once. useId gives each instance unique ids, keeping every
  // <label htmlFor> pointing at its own field.
  const baseId = useId();
  const id = (name: keyof Values & string) => `${baseId}-${name}`;
  const errorId = (name: keyof Values & string) => `${baseId}-${name}-error`;

  const errors: Partial<Record<keyof Values, string[]>> = clientErrors ?? state.errors ?? {};
  const values = state.values ?? defaultValues;

  const focusFirstInvalid = (
    form: HTMLFormElement | null,
    fieldErrors: Partial<Record<keyof Values, string[]>>,
  ) => {
    const name = fieldOrder.find((field) => fieldErrors[field]?.length);
    if (!name || !form) return;
    // By id first: a checkbox group gives its first box the field's id, while
    // its name points at hidden inputs that cannot take focus.
    const element = form.ownerDocument.getElementById(id(name)) ?? form.elements.namedItem(name);
    if (element instanceof HTMLElement) element.focus();
  };

  // After the server answers with errors, move focus to the first invalid field.
  useEffect(() => {
    if (state.errors) {
      submitted.current = false;
      focusFirstInvalid(formRef.current, state.errors);
    }
    // focusFirstInvalid only depends on fieldOrder and the ids, which never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // When this page gets hidden after a successful save, clear the form so that
  // coming back starts fresh. Unsaved drafts are kept.
  useLayoutEffect(() => {
    const form = formRef.current;
    return () => {
      if (submitted.current) {
        submitted.current = false;
        form?.reset();
        setClientErrors(null);
      }
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const data = readForm(new FormData(event.currentTarget));
    const result = schema.safeParse(data);
    if (!result.success) {
      // Stop here: the server would reject it anyway, and this is instant.
      event.preventDefault();
      const fieldErrors = z.flattenError(result.error).fieldErrors as Partial<
        Record<keyof Values, string[]>
      >;
      setClientErrors(fieldErrors);
      focusFirstInvalid(event.currentTarget, fieldErrors);
      return;
    }
    setClientErrors(null);
    submitted.current = true;
  }

  /** id, name and ARIA wiring for one input. */
  function fieldProps(name: keyof Values & string) {
    return {
      id: id(name),
      name,
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name] ? errorId(name) : undefined,
    };
  }

  const formProps = {
    ref: formRef,
    action: formAction,
    onSubmit: handleSubmit,
    noValidate: true,
  };

  return {
    formProps,
    fieldProps,
    id,
    errorId,
    errors,
    values,
    pending,
    formError: state.formError,
  };
}

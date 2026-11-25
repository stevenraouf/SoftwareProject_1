"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "./api";

export class FieldError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof FieldError) return { [error.field]: error.message };
  if (error instanceof ApiError)
    return Object.fromEntries(
      error.fields.map((f) => [f.field, f.messages.join(" ")]),
    );
  return {};
}

function isControl(target: EventTarget) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  return {
    errors,
    setErrors,
    formEvents: {
      onInvalidCapture(event: FormEvent<HTMLFormElement>) {
        const field = event.target;
        if (isControl(field) && field.name) {
          const message =
            field.title &&
            (field.validity.patternMismatch || field.validity.valueMissing)
              ? field.title
              : field.validationMessage;
          setErrors((previous) => ({ ...previous, [field.name]: message }));
        }
      },
      onChangeCapture(event: FormEvent<HTMLFormElement>) {
        const field = event.target;
        if (isControl(field) && errors[field.name]) {
          setErrors((previous) => {
            const updated = { ...previous };
            delete updated[field.name];
            return updated;
          });
        }
      },
    },
  };
}

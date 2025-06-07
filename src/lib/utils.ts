import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  // Accept 0 as a valid class, but ignore false/null/undefined/empty string
  return twMerge(
    clsx(
      inputs
        .map((i) => (i === 0 ? "0" : i))
        .filter(
          (i) => i !== false && i !== null && i !== undefined && i !== ""
        )
    )
  );
}

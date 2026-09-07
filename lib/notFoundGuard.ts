import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";

/**
 * Wraps a service call that may throw NotFoundError, converting it into
 * Next's notFound() (rendering the nearest not-found.tsx) instead of
 * letting it bubble up as an unstyled 500. Any other error still
 * propagates to the nearest error.tsx.
 */
export async function getOrNotFound<T>(fetcher: () => Promise<T>): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
}

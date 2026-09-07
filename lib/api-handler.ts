import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { AuthError } from "@/lib/auth/guard";

/**
 * Wraps every API route handler so failures come back as a consistent
 * JSON error shape instead of leaking stack traces, and so a thrown
 * AuthError/AppError maps to the right HTTP status automatically.
 */
export function withApiHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: { code: "AUTH_ERROR", message: error.message } },
          { status: error.status }
        );
      }
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status }
        );
      }
      console.error("Unhandled API error:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
        { status: 500 }
      );
    }
  };
}

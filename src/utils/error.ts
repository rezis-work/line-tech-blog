import { ServerResponse } from "http";

export function handleApiError(
  res: ServerResponse,
  error: unknown,
  defaultStatusCode: number = 500,
  errorMessage: string = "An unknown error occurred"
): void {
  if (res.writableEnded) {
    return;
  }
  if (!res.hasHeader("Content-Type")) {
    res.setHeader("Content-Type", "application/json");
  }

  if (error instanceof Error) {
    res.statusCode = 401;
    console.error("Checking error", error.message);
    res.end(JSON.stringify({ error: error.message }));
  } else {
    res.statusCode = defaultStatusCode;
    console.error("Checking error 2", error);
    res.end(JSON.stringify({ error: errorMessage }));
  }
}

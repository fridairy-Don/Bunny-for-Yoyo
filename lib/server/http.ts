import "server-only";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function expectOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return response;
  }

  let detail = fallbackMessage;

  try {
    const payload = await response.text();
    if (payload) {
      detail = payload;
    }
  } catch {
    // ignore read failures and use the fallback message
  }

  throw new HttpError(response.status, detail);
}

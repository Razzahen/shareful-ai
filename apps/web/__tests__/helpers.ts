export function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getRequest(url: string): Request {
  return new Request(url);
}

export async function parseResponse(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

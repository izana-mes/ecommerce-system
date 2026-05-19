const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000/api";

export async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function streamChat(path: string, token: string, body: unknown, onEvent: (event: string, data: any) => void): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!response.body) return reject(new Error("Empty stream body"));
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const event = chunk.match(/^event: (.*)$/m)?.[1]?.trim() ?? "message";
        const dataRaw = chunk.match(/^data: (.*)$/m)?.[1] ?? "{}";
        onEvent(event, JSON.parse(dataRaw));
      }
    }
    resolve();
  });
}

export const API_BASE = "";

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}

export async function getJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}

export async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}

export async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }
  return payload;
}

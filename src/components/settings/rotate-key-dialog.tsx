"use client";

import { FormEvent, useState } from "react";

import { requestJson } from "@/components/settings/types";

type RotateKeyDialogProps = {
  providerId: string | null;
  onDone: () => Promise<void>;
};

export function RotateKeyDialog({ providerId, onDone }: RotateKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!providerId || apiKey.trim().length === 0 || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await requestJson<{ success: boolean; keyVersion: number }>(
        `/api/settings/providers/${providerId}/rotate-key`,
        {
          method: "POST",
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        },
      );
      setMessage(`密钥已轮换，keyVersion=${result.keyVersion}`);
      setApiKey("");
      await onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "轮换失败");
    } finally {
      setLoading(false);
    }
  }

  if (!providerId) {
    return (
      <article className="cn-panel">
        <h3 className="cn-card-title">Rotate Key</h3>
        <p className="cn-card-description">请选择一个 Provider 后操作。</p>
      </article>
    );
  }

  return (
    <article className="cn-panel">
      <h3 className="cn-card-title">Rotate Key</h3>
      <p className="cn-card-description">Provider ID: {providerId}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="cn-card-description">新 API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "提交中..." : "Rotate"}
        </button>
      </form>

      {message ? <p className="cn-card-description">{message}</p> : null}
    </article>
  );
}

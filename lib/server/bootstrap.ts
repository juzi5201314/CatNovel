import type { BootstrapPayload } from "@/lib/contracts/bootstrap";
import { getBootstrapPayload } from "@/lib/server/services/bootstrap-service";

export function loadBootstrapPayload(): BootstrapPayload {
  return getBootstrapPayload();
}

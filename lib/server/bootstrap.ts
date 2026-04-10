import type { BootstrapPayload } from '../contracts/bootstrap.ts';
import { getBootstrapPayload } from './services/bootstrap-service.ts';

export function loadBootstrapPayload(workId?: string): BootstrapPayload {
  return getBootstrapPayload(workId);
}

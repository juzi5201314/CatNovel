import {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
  registerFauxProvider,
} from '@mariozechner/pi-ai';
import type {
  AssistantMessage,
  FauxContentBlock,
  FauxProviderRegistration,
  FauxResponseFactory,
  Model,
  RegisterFauxProviderOptions,
} from '@mariozechner/pi-ai';

const deterministicTokenSize = {
  min: 1024,
  max: 1024,
} as const;

export type FauxProviderResponse =
  | string
  | FauxContentBlock
  | FauxContentBlock[]
  | AssistantMessage
  | FauxResponseFactory;

export interface FauxProviderSetup {
  providerId: string;
  model: Model<string>;
  registration: FauxProviderRegistration;
  setResponse: (response: FauxProviderResponse) => void;
  setResponses: (responses: FauxProviderResponse[]) => void;
  appendResponse: (response: FauxProviderResponse) => void;
  appendResponses: (responses: FauxProviderResponse[]) => void;
  getPendingCount: () => number;
  cleanup: () => void;
}

export function createFauxProvider(
  options: RegisterFauxProviderOptions = {},
): FauxProviderSetup {
  const registration = registerFauxProvider({
    ...options,
    tokenSize: options.tokenSize ?? deterministicTokenSize,
  });
  const model = registration.getModel();
  let isCleanedUp = false;

  return {
    providerId: model.id,
    model,
    registration,
    setResponse(response) {
      registration.setResponses([normalizeResponse(response)]);
    },
    setResponses(responses) {
      registration.setResponses(responses.map(normalizeResponse));
    },
    appendResponse(response) {
      registration.appendResponses([normalizeResponse(response)]);
    },
    appendResponses(responses) {
      registration.appendResponses(responses.map(normalizeResponse));
    },
    getPendingCount() {
      return registration.getPendingResponseCount();
    },
    cleanup() {
      if (isCleanedUp) {
        return;
      }

      registration.unregister();
      isCleanedUp = true;
    },
  };
}

function normalizeResponse(response: FauxProviderResponse) {
  if (typeof response === 'function') {
    return response;
  }

  if (typeof response === 'string') {
    return fauxAssistantMessage(response);
  }

  if (isAssistantMessage(response)) {
    return response;
  }

  if (Array.isArray(response)) {
    return fauxAssistantMessage(response);
  }

  return fauxAssistantMessage(response);
}

function isAssistantMessage(value: unknown): value is AssistantMessage {
  return typeof value === 'object' && value !== null && 'role' in value && value.role === 'assistant';
}

export { fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall };

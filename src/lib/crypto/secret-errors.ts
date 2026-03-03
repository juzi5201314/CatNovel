export function isSecretAuthenticationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("unable to authenticate data") ||
    message.includes("unsupported state") ||
    message.includes("auth tag")
  );
}

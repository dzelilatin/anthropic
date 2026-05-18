import { getErrorMessage } from "@ai-sdk/provider-utils";

export function formatChatErrorMessage(error: unknown): string {
  const message = getErrorMessage(error);

  if (message.includes("credit balance is too low")) {
    return "Anthropic API credits are exhausted. Add credits at console.anthropic.com, or remove ANTHROPIC_API_KEY from .env to use the built-in demo mode.";
  }

  if (message === "An error occurred." || message === "unknown error") {
    return "The AI request failed. Remove ANTHROPIC_API_KEY from .env to use demo mode, or check the server logs for details.";
  }

  return message;
}

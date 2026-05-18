"use client";

import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useChat } from "@/lib/contexts/chat-context";
import { AlertCircle } from "lucide-react";
import { formatChatErrorMessage } from "@/lib/format-chat-error";

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, status, error } =
    useChat();

  return (
    <div className="flex flex-col h-full p-4 overflow-hidden">
      {error && (
        <div
          role="alert"
          className="mb-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formatChatErrorMessage(error)}</span>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isLoading={status === "streaming"} />
      </div>
      <div className="mt-4 flex-shrink-0">
        <MessageInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={status === "submitted" || status === "streaming"}
        />
      </div>
    </div>
  );
}

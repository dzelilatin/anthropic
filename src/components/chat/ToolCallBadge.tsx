"use client";

import { Loader2 } from "lucide-react";

interface ToolCallBadgeProps {
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "partial-call" | "result";
  hasResult: boolean;
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export function getToolLabel(toolName: string, args: Record<string, unknown>): string {
  const path = typeof args.path === "string" ? args.path : null;
  const filename = path ? basename(path) : null;
  const name = filename ? ` ${filename}` : "";

  if (toolName === "str_replace_editor") {
    const command = args.command as string | undefined;
    if (command === "create") return `Creating${name}`;
    if (command === "view") return `Reading${name}`;
    if (command === "str_replace" || command === "insert" || command === "undo_edit") return `Editing${name}`;
    return filename ? `Editing${name}` : toolName;
  }

  if (toolName === "file_manager") {
    const command = args.command as string | undefined;
    if (command === "delete") return `Deleting${name}`;
    if (command === "rename") {
      const newPath = typeof args.new_path === "string" ? args.new_path : null;
      const newName = newPath ? basename(newPath) : null;
      return newName ? `Renaming to ${newName}` : `Renaming${name}`;
    }
    return filename ? `Updating${name}` : toolName;
  }

  return toolName;
}

export function ToolCallBadge({ toolName, args, state, hasResult }: ToolCallBadgeProps) {
  const done = state === "result" && hasResult;
  const label = getToolLabel(toolName, args);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {done ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}

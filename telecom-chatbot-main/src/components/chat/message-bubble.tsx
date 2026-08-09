import { useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  Info,
  Paperclip,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import { ResponseCardRenderer } from "@/components/chat/response-cards";
import type { ChatMessage } from "@/lib/telecom-types";

interface Props {
  message: ChatMessage;
  onFeedback: (id: string, feedback: "helpful" | "not-helpful") => void;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
}

export function MessageBubble({ message, onFeedback, onSuggestion, onRetry }: Props) {
  const [copied, setCopied] = useState(false);

  if (message.role === "system") {
    return (
      <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-lg border border-teal/40 bg-teal/10 px-3 py-2 text-xs text-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-teal-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1">{message.text}</p>
        <time className="shrink-0 text-muted-foreground" dateTime={message.timestamp}>
          {formatTime(message.timestamp)}
        </time>
      </div>
    );
  }

  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`flex gap-2.5 sm:gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
        }`}
        aria-hidden="true"
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div className={`flex min-w-0 flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`max-w-[min(36rem,85vw)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border bg-card text-card-foreground shadow-card"
          } ${message.status === "failed" ? "opacity-70 ring-1 ring-destructive" : ""}`}
        >
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
          {message.attachment ? (
            <p className="mt-2 flex items-center gap-1 text-xs opacity-90">
              <Paperclip className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{message.attachment.name}</span>
              <span className="shrink-0">• {message.attachment.sizeKb} KB</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <time className="text-[11px] text-muted-foreground" dateTime={message.timestamp}>
            {formatTime(message.timestamp)}
          </time>

          {isUser && message.status === "sending" ? (
            <span className="text-[11px] text-muted-foreground">Sending…</span>
          ) : null}

          {isUser && message.status === "failed" ? (
            <>
              <span className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="size-3" aria-hidden="true" /> Not delivered
              </span>
              <Button size="sm" variant="outline" className="h-6 rounded-full text-[11px]" onClick={onRetry}>
                <RotateCcw className="mr-1 size-3" aria-hidden="true" /> Retry
              </Button>
            </>
          ) : null}

          {!isUser && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground"
                aria-label="Copy response"
                onClick={() => void copy()}
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-muted-foreground"
                aria-label="Regenerate this response"
                onClick={onRetry}
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={`size-6 ${message.feedback === "helpful" ? "text-success" : "text-muted-foreground"}`}
                aria-label="Mark response as helpful"
                aria-pressed={message.feedback === "helpful"}
                onClick={() => onFeedback(message.id, "helpful")}
              >
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={`size-6 ${message.feedback === "not-helpful" ? "text-destructive" : "text-muted-foreground"}`}
                aria-label="Mark response as not helpful"
                aria-pressed={message.feedback === "not-helpful"}
                onClick={() => onFeedback(message.id, "not-helpful")}
              >
                <ThumbsDown className="size-3.5" />
              </Button>
              {message.feedback ? (
                <span className="text-[11px] text-muted-foreground">Thanks for the feedback</span>
              ) : null}
            </div>
          )}
        </div>

        {message.cards?.length ? (
          <div className="w-full space-y-3">
            {message.cards.map((card, index) => (
              <ResponseCardRenderer key={`${card.kind}-${index}`} card={card} />
            ))}
          </div>
        ) : null}

        {message.suggestions?.length ? (
          <div className="flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                size="sm"
                variant="outline"
                className="h-7 rounded-full bg-surface text-xs"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3" aria-live="polite" aria-label="Assistant is typing">
      <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Bot className="size-4" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 shadow-card">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${dot * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Paperclip, SendHorizonal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { telecomService } from "@/services/telecom-service";
import type { ChatAttachment } from "@/lib/telecom-types";

const MAX_CHARS = 500;

interface Props {
  disabled: boolean;
  onSend: (text: string, attachment?: ChatAttachment) => void;
  focusSignal: number;
}

export function Composer({ disabled, onSend, focusSignal }: Props) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [focusSignal, disabled]);

  const submit = () => {
    if (!value.trim() || disabled || attachment?.status === "uploading") return;
    onSend(value.trim(), attachment ?? undefined);
    setValue("");
    setAttachment(null);
  };

  const handleFile = async (file: File) => {
    setAttachment({
      id: "pending",
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      status: "uploading",
    });
    try {
      setAttachment(await telecomService.uploadAttachment({ name: file.name, size: file.size }));
    } catch {
      setAttachment((prev) => (prev ? { ...prev, status: "failed" } : prev));
      toast.error("Attachment upload failed. Try again.");
    }
  };

  const remaining = MAX_CHARS - value.length;

  return (
    <div className="sticky bottom-0 border-t bg-surface/85 px-3 pt-3 pb-3 backdrop-blur sm:px-6">
      <div className="mx-auto max-w-3xl">
        {attachment ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
            {attachment.status === "uploading" ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : (
              <Paperclip className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {attachment.status === "uploading"
                ? "Uploading…"
                : attachment.status === "failed"
                  ? "Failed"
                  : `${attachment.sizeKb} KB`}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              aria-label="Remove attachment"
              onClick={() => setAttachment(null)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : null}

        <div className="flex items-end gap-1.5 rounded-2xl border bg-card p-2 shadow-card focus-within:ring-2 focus-within:ring-ring/40">
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            accept="image/*,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Attach a screenshot or document"
            className="size-9 shrink-0"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" />
          </Button>

          <label className="sr-only" htmlFor="chat-input">
            Message NovaTel Assist
          </label>
          <Textarea
            id="chat-input"
            ref={inputRef}
            value={value}
            maxLength={MAX_CHARS}
            disabled={disabled}
            placeholder="Ask about balance, bills, plans, roaming or network issues…"
            className="max-h-40 min-h-10 resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
            rows={1}
            aria-describedby="composer-disclaimer composer-counter"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />

          <Button
            size="icon"
            variant={listening ? "destructive" : "ghost"}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            aria-pressed={listening}
            className="size-9 shrink-0"
            disabled={disabled}
            onClick={() => {
              setListening((prev) => !prev);
              toast.info(listening ? "Voice input stopped" : "Listening… speak your request");
            }}
          >
            <Mic className="size-4" />
          </Button>

          <Button
            size="icon"
            aria-label={disabled ? "Sending message" : "Send message"}
            className="size-9 shrink-0"
            disabled={disabled || !value.trim() || attachment?.status === "uploading"}
            onClick={submit}
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizonal className="size-4" />
            )}
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p id="composer-disclaimer">Never share OTP, PIN or passwords.</p>
          <p id="composer-counter" aria-live="polite" className={remaining < 50 ? "text-destructive" : ""}>
            {value.length}/{MAX_CHARS}
          </p>
        </div>
      </div>
    </div>
  );
}

import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface MultiSelectProps {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A dropdown that keeps a set of values instead of one. Selections show as
 * removable chips in the trigger; the list stays open while you pick so
 * several can be chosen in a row.
 */
export const MultiSelect = ({
  options,
  value,
  onChange,
  placeholder = "Not set",
  disabled = false,
  className = "",
}: MultiSelectProps) => {
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={`w-full min-h-9 flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/40 transition-colors ${className}`}
        >
          <span className="flex-1 flex flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((v) => (
                <Badge
                  key={v}
                  variant="secondary"
                  className="h-5 px-1.5 text-[11px] font-normal gap-1"
                >
                  {v}
                  {!disabled && (
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Remove ${v}`}
                      onClick={(e) => {
                        // Chip removal must not open the dropdown.
                        e.stopPropagation();
                        onChange(value.filter((x) => x !== v));
                      }}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Badge>
              ))
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`w-full flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-muted ${
                selected ? "text-foreground font-medium" : "text-foreground/80"
              }`}
            >
              {option}
              {selected && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

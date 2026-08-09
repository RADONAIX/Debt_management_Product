import { Button } from "@/components/ui/button";
import { ChevronDown, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const { toast } = useToast();

  const handleSaveDraft = () => {
    toast({
      title: "Draft Saved",
      description: "Your strategy has been saved as a draft.",
    });
  };

  const handlePublish = () => {
    toast({
      title: "Strategy Published",
      description: "Your strategy has been published successfully.",
    });
  };

  const handleHistorySelect = (version: string) => {
    toast({
      title: "Version Selected",
      description: `Loaded ${version}`,
    });
  };

  const handleLanguageChange = (language: string) => {
    toast({
      title: "Language Changed",
      description: `Interface language changed to ${language}`,
    });
  };

  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CODE</span>
        <h1 className="text-xl font-semibold text-foreground">Collections Omnichannel Dunning Engine</h1>
      </div>
      
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleSaveDraft}>
          Save Draft
        </Button>
        <Button variant="ghost" size="sm" onClick={handlePublish}>
          Publish Strategy
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              History
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover">
            <DropdownMenuItem onClick={() => handleHistorySelect("Version 1.0")}>
              Version 1.0 (Current)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleHistorySelect("Version 0.9")}>
              Version 0.9
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleHistorySelect("Version 0.8")}>
              Version 0.8
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <Globe className="h-4 w-4" />
              Language
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-popover">
            <DropdownMenuItem onClick={() => handleLanguageChange("English")}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange("Arabic")}>
              العربية
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange("French")}>
              Français
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleLanguageChange("Spanish")}>
              Español
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

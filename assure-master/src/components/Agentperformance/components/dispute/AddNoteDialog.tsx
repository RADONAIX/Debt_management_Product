import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (note: string, attachments: File[]) => void;
  disputeId: string;
}

export const AddNoteDialog = ({ open, onOpenChange, onSubmit, disputeId }: AddNoteDialogProps) => {
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
      toast.success(`${e.target.files.length} file(s) uploaded`);
    }
  };

  const handleAISuggest = () => {
    setAiSuggesting(true);
    
    setTimeout(() => {
      const suggestions = [
        "Contacted customer via phone - no answer. Will retry tomorrow morning.",
        "Customer confirmed they made payment on time. Checking payment processing logs.",
        "Escalated to senior agent for review due to complexity of the case.",
        "Customer provided additional documentation. Analyzing evidence.",
        "Payment verified in system. Dispute appears valid. Processing refund."
      ];
      
      const suggested = suggestions[Math.floor(Math.random() * suggestions.length)];
      setNote(suggested);
      setAiSuggesting(false);
      toast.success("AI suggestion added");
    }, 1000);
  };

  const handleSubmit = () => {
    if (!note.trim()) {
      toast.error("Please enter a note");
      return;
    }

    onSubmit(note, attachments);
    toast.success("Note added successfully");
    onOpenChange(false);
    setNote("");
    setAttachments([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>Add a note to dispute {disputeId}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note *</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your note..."
              rows={4}
            />
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleAISuggest}
            disabled={aiSuggesting}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {aiSuggesting ? "Generating..." : "AI Suggest Note"}
          </Button>

          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="note-file-upload"
              />
              <label htmlFor="note-file-upload" className="cursor-pointer">
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Upload supporting documents</p>
              </label>
            </div>
            {attachments.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {attachments.length} file(s): {attachments.map(f => f.name).join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            Add Note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

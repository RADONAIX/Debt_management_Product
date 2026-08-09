import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Note } from "@/data/mockCases";
import { Paperclip, Save } from "lucide-react";
import { toast } from "sonner";

interface InteractionsNotesProps {
  notes: Note[];
}

export const InteractionsNotes = ({ notes }: InteractionsNotesProps) => {
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'internal' | 'customer-facing'>('internal');

  const handleSaveNote = () => {
    if (!noteContent.trim()) {
      toast.error('Please enter a note');
      return;
    }
    toast.success('Note saved successfully');
    setNoteContent('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Add New Note</h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              variant={ 'outline'}
              size="sm"
              onClick={() => setNoteType('internal')}
            >
              Internal Note
            </Button>
            <Button
              variant={ 'outline'}
              size="sm"
              onClick={() => setNoteType('customer-facing')}
            >
              Customer-Facing
            </Button>
          </div>
          <Textarea
            placeholder="Enter your note here..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={4}
          />
          <div className="flex gap-2">
            <Button onClick={handleSaveNote} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Save className="h-4 w-4" />
              Save Note
            </Button>
            <Button variant="outline" className="gap-2">
              <Paperclip className="h-4 w-4" />
              Attach File
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Previous Notes</h3>
        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No notes added yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="p-4 border border-border rounded-lg bg-card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{note.agent}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      note.type === 'internal' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    )}>
                      {note.type === 'internal' ? 'Internal' : 'Customer-Facing'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{note.timestamp}</span>
                </div>
                <p className="text-sm text-foreground">{note.content}</p>
                {note.attachments && note.attachments.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {note.attachments.map((file, idx) => (
                      <span key={idx} className="text-xs text-primary flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {file}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

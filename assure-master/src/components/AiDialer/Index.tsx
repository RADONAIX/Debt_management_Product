import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import LiveChatCenter from "./LiveChatCenter";
import { ContactHistory } from "./ContactHistory";

type View = "live" | "history";

/**
 * AI Engagement Center.
 *
 * Two tabs, both about talking to customers: the live queue where bot
 * conversations are handed to a person, and the record of every conversation
 * the desk has had on any channel.
 *
 * The Dashboard and Analytics tabs that used to sit here were hardcoded — a
 * grid of fixed numbers and a set of literal chart arrays — so they have been
 * replaced by Contact History, which reads the activity the rest of the
 * product already writes. Live Chat is untouched.
 */
const AiDialer = ({ canEdit = true, canSeeFloor = true }: {
  canEdit?: boolean;
  /** Whether the agent picker on the history tab is offered. */
  canSeeFloor?: boolean;
}) => {
  const [view, setView] = useState<View>("live");

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Engagement Center"
        description={
          view === "live"
            ? "Monitor bot conversations, accept human handoffs, and continue the same client transcript."
            : "Every call, message and bot exchange the desk has had with customers."
        }
        actions={
          <Badge variant="outline" className="border-success bg-success/10 text-success">
            ● Agent available
          </Badge>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="live">Live Chat</TabsTrigger>
          <TabsTrigger value="history">Contact History</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "live"
        ? <LiveChatCenter canEdit={canEdit} />
        : <ContactHistory canSeeFloor={canSeeFloor} />}
    </div>
  );
};

export default AiDialer;

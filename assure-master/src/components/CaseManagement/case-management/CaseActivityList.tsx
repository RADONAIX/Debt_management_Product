import { FileText, Download, RefreshCw, Phone, MessageSquare, Plus } from "lucide-react";

const activities = [
  {
    id: 1,
    title: "Generate Last Notice",
    subtitle: null,
    time: "10:15 AM",
    icon: FileText,
  },
  {
    id: 2,
    title: "Download Invoice Pack",
    subtitle: null,
    time: "10:15 AM",
    icon: Download,
  },
  {
    id: 3,
    title: "Update CR",
    subtitle: null,
    time: "9:30 AM",
    icon: RefreshCw,
  },
  {
    id: 4,
    title: "Outbound Call",
    subtitle: null,
    time: "8:45 AM",
    icon: Phone,
  },
  {
    id: 5,
    title: "SMS Reminder",
    subtitle: "Updated CRM with CRX...",
    time: "8:02 AM",
    icon: MessageSquare,
  },
  {
    id: 6,
    title: "Case Created",
    subtitle: null,
    time: "7:00 AM",
    icon: Plus,
  },
];

export const CaseActivityList = () => {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-4">Case Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = activity.icon;
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{activity.title}</p>
                {activity.subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{activity.subtitle}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import { FileText, Phone, MessageSquare, Mail, Calendar, DollarSign, Settings } from "lucide-react";
import { Activity } from "@/data/mockCases";

const getIconForType = (type: string) => {
  switch (type) {
    case 'sms': return MessageSquare;
    case 'call': return Phone;
    case 'whatsapp': return MessageSquare;
    case 'email': return Mail;
    case 'note': return FileText;
    case 'ptp': return Calendar;
    case 'payment': return DollarSign;
    case 'system': return Settings;
    default: return FileText;
  }
};

const getColorForType = (type: string) => {
  switch (type) {
    case 'sms': return 'text-blue-500';
    case 'call': return 'text-green-500';
    case 'whatsapp': return 'text-emerald-500';
    case 'email': return 'text-purple-500';
    case 'note': return 'text-yellow-500';
    case 'ptp': return 'text-orange-500';
    case 'payment': return 'text-primary';
    case 'system': return 'text-muted-foreground';
    default: return 'text-foreground';
  }
};

interface ActivityTimelineProps {
  activities: Activity[];
}

export const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No activities recorded yet</p>
      ) : (
        activities.map((activity) => {
          const Icon = getIconForType(activity.type);
          const colorClass = getColorForType(activity.type);
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={cn("flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center", colorClass)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{activity.title}</p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground">{activity.description}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

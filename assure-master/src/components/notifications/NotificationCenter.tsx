import { useState, useEffect } from "react";
import { Bell, X, AlertTriangle, DollarSign, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { customersData } from "@/data/customerData";

interface Notification {
  id: string;
  type: "high-risk" | "payment-alert" | "dispute";
  title: string;
  message: string;
  timestamp: Date;
  customerId: string;
  read: boolean;
}

export const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Generate notifications based on customer data
    const newNotifications: Notification[] = [];

    customersData.forEach((customer) => {
      // High-risk customer alerts
      if (customer.riskLevel === "High Risk") {
        newNotifications.push({
          id: `${customer.customerId}-risk`,
          type: "high-risk",
          title: "High Risk Customer Alert",
          message: `${customer.name} is marked as high risk. Immediate action required.`,
          timestamp: new Date(),
          customerId: customer.customerId,
          read: false
        });
      }

      // Missed payment alerts
      const missedPayments = customer.paymentHistory.filter(p => p.status === "missed");
      if (missedPayments.length > 0) {
        newNotifications.push({
          id: `${customer.customerId}-payment`,
          type: "payment-alert",
          title: "Missed Payment Detected",
          message: `${customer.name} has ${missedPayments.length} missed payment(s). Total: $ ${missedPayments.reduce((sum, p) => sum + p.amount, 0)}`,
          timestamp: new Date(missedPayments[0].date),
          customerId: customer.customerId,
          read: false
        });
      }

      // Late fee adjustments
      const lateFees = customer.adjustments.filter(a => a.type === "Late Fee Applied");
      if (lateFees.length > 0) {
        newNotifications.push({
          id: `${customer.customerId}-late-fee`,
          type: "payment-alert",
          title: "Late Fee Applied",
          message: `${customer.name} has been charged $ ${lateFees.reduce((sum, f) => sum + f.amount, 0)} in late fees.`,
          timestamp: new Date(lateFees[0].date),
          customerId: customer.customerId,
          read: false
        });
      }
    });

    setNotifications(newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "high-risk":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "payment-alert":
        return <DollarSign className="h-4 w-4 text-kpi-light-blue" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} >
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-dashboard-card border-dashboard-border hover:bg-dashboard-card/80">
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-warning text-white border-0"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] bg-white dashboard-border">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all as read
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)] mt-6">
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    notification.read 
                      ? "bg-dashboard-bg border-dashboard-border/50" 
                      : "bg-dashboard-card border-dashboard-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getIcon(notification.type)}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-semibold ${notification.read ? "text-muted-foreground" : "text-foreground"}`}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 -mr-2 -mt-1"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className={`text-xs ${notification.read ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatTime(notification.timestamp)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">•</span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {notification.customerId}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

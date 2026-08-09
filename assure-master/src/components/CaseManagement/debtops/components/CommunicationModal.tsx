import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, MessageSquare } from 'lucide-react';

interface CommunicationModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

// Mock communication data - in real app, this would come from props/API
const mockCommunications = [
  {
    id: '1',
    type: 'Email',
    subject: 'Payment Reminder',
    message: 'Reminder for outstanding invoice #INV-2024-001',
    outcome: 'Read',
    timestamp: '2024-01-15T10:30:00'
  },
  {
    id: '2',
    type: 'Phone',
    subject: 'Follow-up Call',
    message: 'Discussed payment plan options',
    outcome: 'Answered',
    timestamp: '2024-01-14T14:20:00'
  },
  {
    id: '3',
    type: 'SMS',
    subject: 'Payment Due Alert',
    message: 'Your payment is due in 3 days',
    outcome: 'Delivered',
    timestamp: '2024-01-13T09:15:00'
  }
];

export function CommunicationModal({ open, onClose, customerId, customerName }: CommunicationModalProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'Email': return <Mail className="h-4 w-4" />;
      case 'Phone': return <Phone className="h-4 w-4" />;
      case 'SMS': return <MessageSquare className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    if (outcome === 'Answered' || outcome === 'Read') return 'bg-status-success/10 text-status-success border-status-success/20';
    if (outcome === 'No Answer') return 'bg-status-error/10 text-status-error border-status-error/20';
    return 'bg-status-info/10 text-status-info border-status-info/20';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Communication History - {customerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {mockCommunications.map((comm) => (
            <Card key={comm.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getIcon(comm.type)}
                    <span className="font-semibold text-sm">{comm.subject}</span>
                  </div>
                  <Badge className={getOutcomeColor(comm.outcome)}>{comm.outcome}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{comm.message}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{comm.type}</span>
                  <span>•</span>
                  <span>{new Date(comm.timestamp).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

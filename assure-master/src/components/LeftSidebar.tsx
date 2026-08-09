import { MessageSquare, Mail, MessageCircle, Phone, Target, FileText, CreditCard, Send, FileCheck, FolderOpen, AlertCircle, HelpCircle, CheckCircle, XCircle, TrendingUp, Scale, FileWarning, Brain, Radio, Clock, FileQuestion, TrendingDown, ShieldAlert, Bell, Link, Tag, Bot, FileSignature, Database, GitMerge } from "lucide-react";
import { ComponentTile } from "./ComponentTile";

export const LeftSidebar = () => {
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Component Library</h3>
        
        {/* Channels Section */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide">Channels</h4>
          <div className="grid grid-cols-2 gap-2">
            <ComponentTile icon={MessageSquare} label="SMS" />
            <ComponentTile icon={Mail} label="Email" />
            <ComponentTile icon={MessageCircle} label="WhatsApp" />
            <ComponentTile icon={Phone} label="IVR" />
            <ComponentTile icon={Target} label="AI Dialer" />
            <ComponentTile icon={FileText} label="VA" />
            <ComponentTile icon={Bell} label="Push Notification" />
            <ComponentTile icon={Link} label="Payment Link" />
          </div>
        </div>

        {/* Actions Section */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide ">Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <ComponentTile icon={CreditCard} label="Create PTP" />
            <ComponentTile icon={Send} label="Send Payment Link" />
            <ComponentTile icon={FileCheck} label="Generate Settlement" />
            <ComponentTile icon={FolderOpen} label="Create Case" />
            <ComponentTile icon={CheckCircle} label="Credit Validation" />
            <ComponentTile icon={FileWarning} label="Legal Pre-Notice" />
            <ComponentTile icon={XCircle} label="Close Case" />
            <ComponentTile icon={Tag} label="Label Node" />
          </div>
        </div>

        {/* Conditions Section */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide">Conditions</h4>
          <div className="grid grid-cols-2 gap-2">
            <ComponentTile icon={HelpCircle} label="No Response?" />
            <ComponentTile icon={XCircle} label="PTP Broken?" />
            <ComponentTile icon={AlertCircle} label="If Dispute Detected" />
            <ComponentTile icon={ShieldAlert} label="If High-Risk Customer" />
            <ComponentTile icon={CheckCircle} label="If Payment Posted" />
            <ComponentTile icon={TrendingDown} label="If >90 Bucket" />
          </div>
        </div>

        {/* AI Nodes Section */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide">AI Nodes</h4>
          <div className="grid grid-cols-2 gap-2">
            <ComponentTile icon={Brain} label="AI Next-Best-Action" />
            <ComponentTile icon={Radio} label="AI Recommend Channel" />
            <ComponentTile icon={Clock} label="AI Recommend Time-of-Day" />
            <ComponentTile icon={FileQuestion} label="AI Dispute Classifier" />
            <ComponentTile icon={TrendingUp} label="AI Risk Score" />
            <ComponentTile icon={Scale} label="AI PTP Probability" />
          </div>
        </div>

        {/* RPA Nodes Section */}
        <div>
          <h4 className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide">RPA Automations</h4>
          <div className="grid grid-cols-2 gap-2">
            <ComponentTile icon={Bot} label="RPA: Dispute Validation" />
            <ComponentTile icon={FileSignature} label="RPA: PTP Update" />
            <ComponentTile icon={XCircle} label="RPA: Case Closure" />
            <ComponentTile icon={FileText} label="RPA: Document Extraction" />
            <ComponentTile icon={Database} label="RPA: ERP Sync" />
            <ComponentTile icon={GitMerge} label="RPA: Workflow Trigger" />
          </div>
        </div>
      </div>
    </aside>
  );
};

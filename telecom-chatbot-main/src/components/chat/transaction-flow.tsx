import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTransactions } from "@/state/transaction-context";
import { maskMsisdn } from "@/lib/format";
import { subscriber } from "@/lib/mock-data";

/**
 * Step-by-step confirmation for every transactional action:
 * review → OTP verification → processing → receipt with audit reference.
 */
export function TransactionFlow() {
  const { step, descriptor, result, otpError, confirm, submitOtp, cancel, close } =
    useTransactions();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [seconds, setSeconds] = useState(120);

  useEffect(() => {
    if (step !== "otp") {
      setCode("");
      return;
    }
    setSeconds(120);
    const timer = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const open = step !== "idle";
  if (!descriptor) return null;

  const handleOtp = async (value: string) => {
    setVerifying(true);
    await submitOtp(value);
    setVerifying(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? cancel() : undefined)}>
      <DialogContent className="sm:max-w-md">
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>{descriptor.title}</DialogTitle>
              <DialogDescription>{descriptor.summary}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg border bg-surface-2/60 p-3 text-sm">
              {descriptor.lines.map((line) => (
                <div key={line.label} className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="text-right font-medium">{line.value}</span>
                </div>
              ))}
            </div>
            {descriptor.danger ? (
              <Alert variant="destructive">
                <ShieldAlert className="size-4" aria-hidden="true" />
                <AlertTitle>This action is irreversible</AlertTitle>
                <AlertDescription>
                  Continue only if you initiated this request. NovaTel never asks for OTPs over
                  calls or SMS.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
                Secured with OTP verification on {maskMsisdn(subscriber.msisdn, false)}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={cancel}>
                Cancel
              </Button>
              <Button variant={descriptor.danger ? "destructive" : "default"} onClick={confirm}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "otp" && (
          <>
            <DialogHeader>
              <DialogTitle>Verify with OTP</DialogTitle>
              <DialogDescription>
                We sent a 6-digit code to {maskMsisdn(subscriber.msisdn, false)}. Use 123456 in this
                demo environment.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (value.length === 6) void handleOtp(value);
                }}
                aria-label="One time password"
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {otpError ? (
                <p role="alert" className="text-sm text-destructive">
                  {otpError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Code expires in {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                  {String(seconds % 60).padStart(2, "0")}
                </p>
              )}
              {verifying ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Verifying
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={cancel}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">Processing your request securely…</p>
            <p className="text-xs text-muted-foreground">Do not close this window.</p>
          </div>
        )}

        {step === "done" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {result.status === "Success" ? (
                  <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                ) : (
                  <XCircle className="size-5 text-destructive" aria-hidden="true" />
                )}
                {result.status === "Success" ? descriptor.successTitle : "Request failed"}
              </DialogTitle>
              <DialogDescription>{result.message}</DialogDescription>
            </DialogHeader>
            <Separator />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference ID</span>
                <span className="font-mono font-medium">{result.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timestamp</span>
                <span className="font-medium">
                  {new Date(result.timestamp).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Keep this reference for your records. It is also available under Service Requests.
            </p>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

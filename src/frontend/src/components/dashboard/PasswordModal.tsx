import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { useState } from "react";

const ADMIN_PASSWORD = "1234";

interface Props {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PasswordModal({ open, onSuccess, onCancel }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (value === ADMIN_PASSWORD) {
      setValue("");
      setError("");
      onSuccess();
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  const handleClose = () => {
    setValue("");
    setError("");
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent
        className="max-w-xs password-modal-glow"
        data-ocid="password.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <span className="p-1.5 rounded-full bg-primary/10 text-primary">
              <KeyRound className="w-4 h-4" />
            </span>
            Admin Access
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            This action requires admin authorisation. Enter the password to
            continue.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Password
            </Label>
            <Input
              type="password"
              value={value}
              autoFocus
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") handleClose();
              }}
              placeholder="Enter admin password"
              className="h-9 text-sm"
              data-ocid="password.input"
            />
            {error && (
              <p
                className="text-xs text-destructive mt-1"
                data-ocid="password.error_state"
              >
                {error}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            data-ocid="password.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!value.trim()}
            data-ocid="password.confirm_button"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

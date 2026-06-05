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
import { useUpdateAttendance } from "@/hooks/useBackend";
import type { AttendanceRecord } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  record: AttendanceRecord;
  open: boolean;
  onClose: () => void;
}

export default function EditAttendanceModal({ record, open, onClose }: Props) {
  const [entry, setEntry] = useState<string>(record.entry ?? "");
  const [brk, setBrk] = useState<string>(record.breakTime ?? "");
  const [afterBrk, setAfterBrk] = useState<string>(record.afterBreak ?? "");
  const [exit, setExit] = useState<string>(record.exit ?? "");
  const updateMut = useUpdateAttendance();

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        id: record.id,
        entry: entry.trim() || undefined,
        breakTime: brk.trim() || undefined,
        afterBreak: afterBrk.trim() || undefined,
        exit: exit.trim() || undefined,
      });
      toast.success("Attendance updated successfully");
      onClose();
    } catch {
      toast.error("Failed to update attendance. Please try again.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="max-w-md"
        data-ocid="dashboard.edit_attendance.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base font-bold">
            Edit Attendance Record
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Morning Entry
            </Label>
            <Input
              type="time"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="h-9 text-sm"
              data-ocid="dashboard.edit_attendance.entry_input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Break
            </Label>
            <Input
              type="time"
              value={brk}
              onChange={(e) => setBrk(e.target.value)}
              className="h-9 text-sm"
              data-ocid="dashboard.edit_attendance.break_input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              After Break
            </Label>
            <Input
              type="time"
              value={afterBrk}
              onChange={(e) => setAfterBrk(e.target.value)}
              className="h-9 text-sm"
              data-ocid="dashboard.edit_attendance.afterbreak_input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              End Time
            </Label>
            <Input
              type="time"
              value={exit}
              onChange={(e) => setExit(e.target.value)}
              className="h-9 text-sm"
              data-ocid="dashboard.edit_attendance.exit_input"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            data-ocid="dashboard.edit_attendance.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={updateMut.isPending}
            data-ocid="dashboard.edit_attendance.save_button"
          >
            {updateMut.isPending ? "Saving\u2026" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

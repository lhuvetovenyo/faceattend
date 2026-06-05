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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdatePerson } from "@/hooks/useBackend";
import type { Person } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  person: Person;
  open?: boolean;
  onClose: () => void;
}

const NSQF_LEVELS = [
  { value: "Level-III", label: "Level III" },
  { value: "Level-IV", label: "Level IV" },
  { value: "Level-V", label: "Level V" },
] as const;

type NsqfLevelStr = "Level-III" | "Level-IV" | "Level-V" | "";
type SemesterStr = "1st Semester" | "2nd Semester" | "";

export default function EditPersonModal({
  person,
  open = true,
  onClose,
}: Props) {
  const isNSQF =
    person.personType === "NSQF" ||
    (typeof person.personType === "object" &&
      person.personType !== null &&
      "NSQF" in (person.personType as object)) ||
    (person.personType as unknown as string) === "NSQF";
  const [name, setName] = useState(person.name);
  const [rollNo, setRollNo] = useState(person.rollNo ?? "");
  const [course, setCourse] = useState(person.course ?? "");
  const [nsqfLevel, setNsqfLevel] = useState<NsqfLevelStr>(
    (person.nsqfLevel as NsqfLevelStr) ?? "",
  );
  const [semester, setSemester] = useState<SemesterStr>(
    (person.semester as SemesterStr) ?? "",
  );
  const updateMut = useUpdatePerson();

  const isLevelV = nsqfLevel === "Level-V";

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        id: String(person.id),
        name,
        personType: person.personType,
        faceDescriptor: person.faceDescriptor,
        rollNo: rollNo || undefined,
        course: course || undefined,
        nsqfLevel: nsqfLevel || undefined,
        semester: isLevelV ? "1st Semester" : semester || undefined,
      });
      toast.success("Person updated");
      onClose();
    } catch {
      toast.error("Failed to update person. Please try again.");
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
        data-ocid="dashboard.edit_person.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base font-bold">
            Edit Person
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              data-ocid="dashboard.edit_person.name_input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Roll No
            </Label>
            <Input
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm"
              data-ocid="dashboard.edit_person.rollno_input"
            />
          </div>
          {!isNSQF && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Course
              </Label>
              <Input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="Optional"
                className="h-9 text-sm"
                data-ocid="dashboard.edit_person.course_input"
              />
            </div>
          )}
          {isNSQF && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  NSQF Level
                </Label>
                <Select
                  value={nsqfLevel}
                  onValueChange={(v) => {
                    setNsqfLevel(v as NsqfLevelStr);
                    if (v === "Level-V") setSemester("1st Semester");
                  }}
                >
                  <SelectTrigger
                    className="h-9 text-sm"
                    data-ocid="dashboard.edit_person.level_select"
                  >
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {NSQF_LEVELS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isLevelV && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Semester
                  </Label>
                  <Select
                    value={semester}
                    onValueChange={(v) => setSemester(v as SemesterStr)}
                  >
                    <SelectTrigger
                      className="h-9 text-sm"
                      data-ocid="dashboard.edit_person.semester_select"
                    >
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st Semester">1st Semester</SelectItem>
                      <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            data-ocid="dashboard.edit_person.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || updateMut.isPending}
            data-ocid="dashboard.edit_person.save_button"
          >
            {updateMut.isPending ? "Saving\u2026" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import EditPersonModal from "@/components/dashboard/EditPersonModal";
import PasswordModal from "@/components/dashboard/PasswordModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeletePerson, usePersons } from "@/hooks/useBackend";
import type { Person } from "@/types";
import { Pencil, Trash2, Users } from "lucide-react";
import { useState } from "react";

function getTypeLabel(person: Person): string {
  const pt = person.personType as unknown as string;
  if (
    pt === "NSQF" ||
    (typeof person.personType === "object" && "NSQF" in person.personType)
  )
    return "NSQF";
  return "JIG";
}

function semesterLabel(sem: string | undefined): string {
  if (!sem) return "";
  if (sem === "Sem1") return "1st Semester";
  if (sem === "Sem2") return "2nd Semester";
  return sem;
}

function nsqfLevelLabel(raw: string | undefined): string {
  if (!raw) return "\u2014";
  if (raw === "LevelIII") return "Level III";
  if (raw === "LevelIV") return "Level IV";
  if (raw === "LevelV") return "Level V";
  return raw.replace("Level", "Level ");
}

function getCourseLevelDisplay(person: Person): {
  line1: string;
  line2: string;
} {
  const type = getTypeLabel(person);
  if (type === "NSQF") {
    return {
      line1: nsqfLevelLabel(person.nsqfLevel),
      line2: semesterLabel(person.semester),
    };
  }
  return { line1: person.course ?? "\u2014", line2: "" };
}

interface ManagePeopleTabProps {
  onDeleteSuccess?: () => void;
}

export default function ManagePeopleTab({
  onDeleteSuccess,
}: ManagePeopleTabProps = {}) {
  const { data: persons = [] } = usePersons();
  const deleteMut = useDeletePerson();
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pwdAction, setPwdAction] = useState<
    { kind: "edit"; person: Person } | { kind: "delete"; id: string } | null
  >(null);

  const handleDelete = async () => {
    if (deleteId === null) return;
    await deleteMut.mutateAsync(deleteId);
    setDeleteId(null);
    onDeleteSuccess?.();
  };

  return (
    <div
      className="bg-card rounded-xl border border-border overflow-hidden shadow-card"
      data-ocid="dashboard.people.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground font-display">
            Registered People
          </span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {persons.length} total
        </Badge>
      </div>

      {/* Table / Empty */}
      {persons.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-12 gap-2"
          data-ocid="dashboard.people.empty_state"
        >
          <Users className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No people registered yet
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary/5 border-b-2 border-primary/20">
                <th className="px-3 py-2.5 text-left text-foreground font-normal tracking-wide uppercase w-8">
                  #
                </th>
                <th className="px-3 py-2.5 text-left text-foreground font-normal tracking-wide uppercase">
                  Name
                </th>
                <th className="px-3 py-2.5 text-left text-foreground font-normal tracking-wide uppercase">
                  Type
                </th>
                <th className="px-3 py-2.5 text-left text-foreground font-normal tracking-wide uppercase w-24">
                  Roll No
                </th>
                <th className="px-3 py-2.5 text-left text-foreground font-normal tracking-wide uppercase">
                  Level / Course
                </th>
                <th className="px-3 py-2.5 text-right text-foreground font-normal tracking-wide uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {persons.map((person, idx) => {
                const typeLabel = getTypeLabel(person);
                const isNSQF = typeLabel === "NSQF";
                const { line1, line2 } = getCourseLevelDisplay(person);
                return (
                  <tr
                    key={String(person.id)}
                    className="border-b border-border/60 hover:bg-primary/5 transition-colors duration-150"
                    data-ocid={`dashboard.people.item.${idx + 1}`}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 font-normal text-foreground max-w-[130px] truncate">
                      {person.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          isNSQF
                            ? "border-primary/30 text-primary bg-primary/10"
                            : "border-accent/30 text-accent bg-accent/10"
                        }`}
                      >
                        {typeLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-foreground tabular-nums w-24 font-mono">
                      {person.rollNo ?? "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]">
                      <span className="font-normal text-foreground text-xs whitespace-nowrap truncate block">
                        {line1}
                        {line2 ? ` · ${line2}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          aria-label="Edit person"
                          onClick={() => setPwdAction({ kind: "edit", person })}
                          data-ocid={`dashboard.people.edit_button.${idx + 1}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          aria-label="Delete person"
                          onClick={() =>
                            setPwdAction({
                              kind: "delete",
                              id: String(person.id),
                            })
                          }
                          data-ocid={`dashboard.people.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Password Gate */}
      <PasswordModal
        open={pwdAction !== null}
        onSuccess={() => {
          if (!pwdAction) return;
          if (pwdAction.kind === "edit") {
            setEditPerson(pwdAction.person);
          } else {
            setDeleteId(pwdAction.id);
          }
          setPwdAction(null);
        }}
        onCancel={() => setPwdAction(null)}
      />

      {/* Edit Modal — controlled open state prevents blank page */}
      {editPerson && (
        <EditPersonModal
          person={editPerson}
          open={editPerson !== null}
          onClose={() => setEditPerson(null)}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Person"
        description="Deleting this person will also remove their face data. Are you sure?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

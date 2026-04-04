import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AttendanceRecord,
  DescriptorEntry,
  Person,
  PersonSummary,
  Stats,
} from "../backend";
import { useActor } from "./useActor";

export type { DescriptorEntry, PersonSummary, AttendanceRecord, Person, Stats };

export function useGetAllPersons() {
  const { actor, isFetching } = useActor();
  return useQuery<PersonSummary[]>({
    queryKey: ["persons"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPersons();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAllFaceDescriptors() {
  const { actor, isFetching } = useActor();
  return useQuery<DescriptorEntry[]>({
    queryKey: ["descriptors"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllFaceDescriptors();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetAttendanceRecords() {
  const { actor, isFetching } = useActor();
  return useQuery<AttendanceRecord[]>({
    queryKey: ["attendance"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAttendanceRecords();
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });
}

export function useGetStats() {
  const { actor, isFetching } = useActor();
  return useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: async () => {
      if (!actor)
        return {
          activeMonths: [],
          totalPersons: 0n,
          totalAttendance: 0n,
          todayCheckins: 0n,
        };
      return actor.getStats();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useRegisterPerson() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      personTypeStr: string;
      studentId: string;
      employeeId: string;
      name: string;
      rollNo: string;
      batch: string;
      faceDescriptor: number[];
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.registerPerson(
        params.personTypeStr,
        params.studentId,
        params.employeeId,
        params.name,
        params.rollNo,
        params.batch,
        params.faceDescriptor,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
      qc.invalidateQueries({ queryKey: ["descriptors"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useRecordAttendance() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      personId: bigint;
      personTypeStr: string;
      name: string;
      slot: string;
      dateStr: string;
      monthStr: string;
      timeStr: string;
      year: bigint;
      month: bigint;
      day: bigint;
    }) => {
      if (!actor) throw new Error("Not connected");
      const timestamp = BigInt(Date.now()) * 1000000n;
      return actor.recordAttendance(
        params.personId,
        params.personTypeStr,
        params.name,
        params.slot,
        timestamp,
        params.dateStr,
        params.monthStr,
        params.timeStr,
        params.year,
        params.month,
        params.day,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateAttendance() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: bigint;
      name: string;
      slot: string;
      dateStr: string;
      monthStr: string;
      timeStr: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.updateAttendanceRecord(
        params.id,
        params.name,
        params.slot,
        params.dateStr,
        params.monthStr,
        params.timeStr,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useDeleteAttendance() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteAttendanceRecord(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdatePerson() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: bigint;
      studentId: string;
      employeeId: string;
      name: string;
      rollNo: string;
      batch: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.updatePerson(
        params.id,
        params.studentId,
        params.employeeId,
        params.name,
        params.rollNo,
        params.batch,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
    },
  });
}

export function useDeletePerson() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.deletePerson(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
      qc.invalidateQueries({ queryKey: ["descriptors"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useUpdatePersonDescriptor() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: bigint; faceDescriptor: number[] }) => {
      if (!actor) throw new Error("Not connected");
      return actor.updatePersonDescriptor(params.id, params.faceDescriptor);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["descriptors"] });
    },
  });
}

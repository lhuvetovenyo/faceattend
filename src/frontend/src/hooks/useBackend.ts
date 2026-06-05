import {
  type AttendanceUpdateInput,
  type PersonInput,
  createActor,
} from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useBackendActor() {
  return useActor(createActor);
}

export function usePersons() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["persons"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listPersons();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useFaceDescriptors() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["faceDescriptors"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllFaceDescriptors();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAttendance() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAttendance();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useStats() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      if (!actor)
        return {
          totalPersons: 0n,
          todayCheckIns: 0n,
          totalRecords: 0n,
          activeMonths: 0n,
        };
      const [totalPersons, totalRecords, todayCheckIns, activeMonths] =
        await Promise.all([
          actor.getTotalStudents(),
          actor.getTotalCheckIns(),
          actor.getTodayCheckIns(),
          actor.getActiveMonths(),
        ]);
      return { totalPersons, todayCheckIns, totalRecords, activeMonths };
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useAddPerson() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: PersonInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.addPerson(args);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
      qc.invalidateQueries({ queryKey: ["faceDescriptors"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdatePerson() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string } & PersonInput) => {
      if (!actor) throw new Error("Actor not ready");
      const { id, ...input } = args;
      return actor.updatePerson(id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
      qc.invalidateQueries({ queryKey: ["faceDescriptors"] });
    },
  });
}

export function useDeletePerson() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deletePerson(id);
    },
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ["stats"] });
      qc.removeQueries({ queryKey: ["persons"] });
      qc.removeQueries({ queryKey: ["attendance"] });
      qc.removeQueries({ queryKey: ["faceDescriptors"] });
      await qc.invalidateQueries({ queryKey: ["stats"], refetchType: "all" });
      await qc.invalidateQueries({ queryKey: ["persons"], refetchType: "all" });
      await qc.invalidateQueries({
        queryKey: ["attendance"],
        refetchType: "all",
      });
      await qc.invalidateQueries({
        queryKey: ["faceDescriptors"],
        refetchType: "all",
      });
      await Promise.all([
        qc.refetchQueries({ queryKey: ["stats"] }),
        qc.refetchQueries({ queryKey: ["persons"] }),
        qc.refetchQueries({ queryKey: ["attendance"] }),
      ]);
    },
  });
}

export function useRecordAttendance() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      personId: string;
      date: string;
      slot: string;
      time: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.recordAttendance(
        args.personId,
        args.date,
        args.slot,
        args.time,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useUpdateAttendance() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string } & AttendanceUpdateInput) => {
      if (!actor) throw new Error("Actor not ready");
      const { id, ...updates } = args;
      return actor.updateAttendance(id, updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useDeleteAttendance() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteAttendance(id);
    },
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ["stats"] });
      qc.removeQueries({ queryKey: ["attendance"] });
      await qc.invalidateQueries({
        queryKey: ["attendance"],
        refetchType: "all",
      });
      await qc.invalidateQueries({ queryKey: ["stats"], refetchType: "all" });
      await Promise.all([
        qc.refetchQueries({ queryKey: ["stats"] }),
        qc.refetchQueries({ queryKey: ["attendance"] }),
      ]);
    },
  });
}

export function useTestGoogleSheetsSync() {
  const { actor } = useBackendActor();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      if (!actor) throw new Error("Actor not ready");
      const { createSignedJwt } = await import("@/utils/googleSheets");
      const jwt = await createSignedJwt();
      return actor.testGoogleSheetsSync(jwt);
    },
  });
}

export function useClearAllData() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const a = actor as unknown as { clearAllData: () => Promise<void> };
      await a.clearAllData();
    },
    onSuccess: () => {
      queryClient.removeQueries();
      queryClient.invalidateQueries();
    },
  });
}

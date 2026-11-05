import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { POPUP_REGISTRY } from "../components/popups/popupRegistry";
import useAuthStore from "./AuthStore";

const buildId = (type, data) => {
  const builder = POPUP_REGISTRY[type]?.buildId;
  if (builder) return builder(data);
  return `${type}__${data.name}__${data.source}`;
};

export const usePopupStore = create(
  persist(
    (set, get) => ({
      openPopups: [],
      minimized: [],
      zCounter: 100,

      open: (type, data) => {
        const id = buildId(type, data);
        const state = get();
        if (state.minimized.some((p) => p.id === id)) {
          get().restore(id);
          return;
        }
        if (state.openPopups.some((p) => p.id === id)) {
          get().focus(id);
          return;
        }

        const entry = POPUP_REGISTRY[type];
        if (!entry) {
          console.warn(`Unknown popup type: ${type}`);
          return;
        }

        const offset = state.openPopups.length * 30;
        const z = state.zCounter + 1;

        set({
          openPopups: [
            ...state.openPopups,
            {
              id, type, data,
              x: 120 + offset,
              y: 80 + offset,
              width: entry.defaultWidth ?? 520,
              height: entry.defaultHeight ?? 620,
              zIndex: z,
            },
          ],
          zCounter: z,
        });
      },

      close: (id) =>
        set((s) => ({ openPopups: s.openPopups.filter((p) => p.id !== id) })),

      minimize: (id) =>
        set((s) => {
          const target = s.openPopups.find((p) => p.id === id);
          if (!target) return s;
          const { zIndex, ...rest } = target;
          return {
            openPopups: s.openPopups.filter((p) => p.id !== id),
            minimized: [...s.minimized, rest],
          };
        }),

      restore: (id) =>
        set((s) => {
          const target = s.minimized.find((p) => p.id === id);
          if (!target) return s;
          const z = s.zCounter + 1;
          return {
            minimized: s.minimized.filter((p) => p.id !== id),
            openPopups: [...s.openPopups, { ...target, zIndex: z }],
            zCounter: z,
          };
        }),

      focus: (id) =>
        set((s) => {
          const z = s.zCounter + 1;
          return {
            zCounter: z,
            openPopups: s.openPopups.map((p) =>
              p.id === id ? { ...p, zIndex: z } : p
            ),
          };
        }),

      move: (id, x, y) =>
        set((s) => ({
          openPopups: s.openPopups.map((p) =>
            p.id === id ? { ...p, x, y } : p
          ),
        })),

      resize: (id, width, height) =>
        set((s) => ({
          openPopups: s.openPopups.map((p) =>
            p.id === id ? { ...p, width, height } : p
          ),
        })),

      clearMinimized: () => set({ minimized: [] }),
    }),
    {
      name: `popup-storage:${useAuthStore.getState().userData?.name || "anon"}`,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ minimized: state.minimized }),
    }
  )
);

// Re-key storage when the user changes (login/logout).
useAuthStore.subscribe((state, prev) => {
  const newName = state.userData?.name;
  const oldName = prev?.userData?.name;
  if (newName === oldName) return;
  const key = `popup-storage:${newName || "anon"}`;
  usePopupStore.persist.setOptions({ name: key });
  usePopupStore.persist.rehydrate();
});
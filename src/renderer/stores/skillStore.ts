import { create } from 'zustand';

interface SkillState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const useSkillStore = create<SkillState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
}));

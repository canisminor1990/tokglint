import { create } from 'zustand';

import { type PageId } from './types';

type SaveState = 'idle' | 'saved' | 'error';

interface ConsoleStore {
  beginPending: () => void;
  clearSave: () => void;
  markError: () => void;
  markSaved: () => void;
  page: PageId;
  pending: boolean;
  recording: boolean;
  refreshing: boolean;
  saveState: SaveState;
  setPage: (page: PageId) => void;
  setRecording: (recording: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
}

export const useConsoleStore = create<ConsoleStore>((set) => ({
  page: 'overview',
  pending: false,
  recording: false,
  refreshing: false,
  saveState: 'idle',
  beginPending: () => set({ pending: true, saveState: 'idle' }),
  clearSave: () => set({ saveState: 'idle' }),
  markError: () => set({ pending: false, saveState: 'error' }),
  markSaved: () => set({ pending: false, saveState: 'saved' }),
  setPage: (page) => set({ page }),
  setRecording: (recording) => set({ recording }),
  setRefreshing: (refreshing) => set({ refreshing }),
}));

import { create } from "zustand";

export type Tab = "tasks" | "shop" | "punishments" | "notebook";
export type ManagementPanel = "account" | "room" | null;

export interface AppState {
  // Navigation
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  // UI State
  showHouseManagement: boolean;
  setShowHouseManagement: (show: boolean) => void;
  managementPanel: ManagementPanel;
  setManagementPanel: (panel: ManagementPanel) => void;
  showCreateSheet: boolean;
  setShowCreateSheet: (show: boolean) => void;
  createSheetType: "task" | "wheel" | "reward" | "privilege" | "punishment" | "note" | "journal" | "agreement" | null;
  setCreateSheetType: (type: AppState["createSheetType"]) => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;

  // FAB
  fabOpen: boolean;
  setFabOpen: (open: boolean) => void;

  // Toast
  toast: { message: string; type: "success" | "error" | "info" } | null;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  clearToast: () => void;

  // Shop sub-tab
  shopSubTab: "rewards" | "privileges";
  setShopSubTab: (tab: "rewards" | "privileges") => void;

  // Notebook sub-tab
  notebookSubTab: string;
  setNotebookSubTab: (tab: string) => void;

}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  activeTab: "tasks",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // UI State
  showHouseManagement: false,
  setShowHouseManagement: (show) =>
    set({ showHouseManagement: show, managementPanel: show ? "room" : null }),
  managementPanel: null,
  setManagementPanel: (panel) =>
    set({ managementPanel: panel, showHouseManagement: panel !== null }),
  showCreateSheet: false,
  setShowCreateSheet: (show) => set({ showCreateSheet: show }),
  createSheetType: null,
  setCreateSheetType: (type) => set({ createSheetType: type, showCreateSheet: !!type }),
  selectedCategory: null,
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),

  // FAB
  fabOpen: false,
  setFabOpen: (open) => set({ fabOpen: open }),

  // Toast
  toast: null,
  showToast: (message, type = "info") => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),

  // Shop sub-tab
  shopSubTab: "rewards",
  setShopSubTab: (tab) => set({ shopSubTab: tab }),

  // Notebook sub-tab
  notebookSubTab: "overview",
  setNotebookSubTab: (tab) => set({ notebookSubTab: tab }),
}));

import { create } from "zustand";

interface FilterState {
  dateRange: "7d" | "30d" | "3m" | "12m";
  selectedCity: string | null;
  setDateRange: (range: "7d" | "30d" | "3m" | "12m") => void;
  setSelectedCity: (city: string | null) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  dateRange: "12m",
  selectedCity: null,
  setDateRange: (range) => set({ dateRange: range }),
  setSelectedCity: (city) => set({ selectedCity: city }),
}));

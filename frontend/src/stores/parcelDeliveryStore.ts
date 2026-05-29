import { create } from "zustand"

function today() {
  return new Date().toISOString().split("T")[0]
}

function firstOfCurrentMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]
}

interface ParcelDeliveryFilterState {
  startDate: string
  endDate: string
  deliveryType: "all" | "HD" | "SD"
  setStartDate: (d: string) => void
  setEndDate: (d: string) => void
  setDeliveryType: (t: "all" | "HD" | "SD") => void
  rangeDays: () => number
}

export const useParcelDeliveryStore = create<ParcelDeliveryFilterState>((set, get) => ({
  startDate: firstOfCurrentMonth(),
  endDate: today(),
  deliveryType: "all",
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setDeliveryType: (deliveryType) => set({ deliveryType }),
  rangeDays: () => {
    const { startDate, endDate } = get()
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime()
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
  },
}))

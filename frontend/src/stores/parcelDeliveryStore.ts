import { create } from "zustand"

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}

function subDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split("T")[0]
}

interface ParcelDeliveryFilterState {
  startDate: string
  endDate: string
  deliveryType: "all" | "HD" | "SD"
  usingMock: boolean
  setStartDate: (d: string) => void
  setEndDate: (d: string) => void
  setDeliveryType: (t: "all" | "HD" | "SD") => void
  setUsingMock: (v: boolean) => void
  rangeDays: () => number
}

export const useParcelDeliveryStore = create<ParcelDeliveryFilterState>((set, get) => ({
  startDate: subDays(7),
  endDate: yesterday(),
  deliveryType: "all",
  usingMock: false,
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setDeliveryType: (deliveryType) => set({ deliveryType }),
  setUsingMock: (usingMock) => set({ usingMock }),
  rangeDays: () => {
    const { startDate, endDate } = get()
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime()
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
  },
}))

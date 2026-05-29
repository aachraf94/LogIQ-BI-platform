import { create } from "zustand"

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}

function sevenDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split("T")[0]
}

interface TransportFilterState {
  startDate: string
  endDate: string
  serviceType: "all" | "course_dediee" | "courrier" | "manutention"
  usingMock: boolean
  setStartDate: (d: string) => void
  setEndDate: (d: string) => void
  setServiceType: (t: "all" | "course_dediee" | "courrier" | "manutention") => void
  setUsingMock: (v: boolean) => void
  rangeDays: () => number
}

export const useTransportStore = create<TransportFilterState>((set, get) => ({
  startDate: sevenDaysAgo(),
  endDate: yesterday(),
  serviceType: "all",
  usingMock: false,
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setServiceType: (serviceType) => set({ serviceType }),
  setUsingMock: (usingMock) => set({ usingMock }),
  rangeDays: () => {
    const { startDate, endDate } = get()
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime()
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
  },
}))

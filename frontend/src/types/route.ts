export interface City {
  name: string;
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  avgDuration: number;
  actualCost: number;
  optimizedCost: number;
  savingsPotential: number;
  costPerKm: number;
  volume: number;
  efficiencyScore: number;
}

export interface NetworkNode {
  id: string;
  city: string;
  lat: number;
  lng: number;
  volume: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  volume: number;
  cost: number;
}

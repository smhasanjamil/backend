export interface ICreatePlanRequest {
  name: string;
  description?: string;
  price: number;
  interval: "MONTH" | "YEAR";
  trialDays?: number;
  features?: string[];
}

export interface IUpdatePlanRequest {
  name?: string;
  description?: string;
  price?: number;
  interval?: "MONTH" | "YEAR";
  trialDays?: number;
  isActive?: boolean;
  features?: string[];
}

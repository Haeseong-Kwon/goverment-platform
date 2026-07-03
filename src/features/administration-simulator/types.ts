export type AccountKey = "promo" | "machine" | "labor";
export type QueueId = "q1" | "q2" | "q3" | "q4";
export type GateRole = "manager" | "accountant";

export interface Evidence {
  name: string;
  attached: boolean;
  file?: string;
}

export interface Limit {
  label: string;
  requested: number;
  remaining: number;
  state: "danger" | "success" | "neutral";
  percent: number;
  caption: string;
  badge: string;
}

export interface ReviewDetail {
  title: string;
  amount: string;
  account: string;
}


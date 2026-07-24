export interface AppSettings {
  baseElo: number;
  kWin: number;
  kLoss: number;
  baseOdds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  baseElo: 1000,
  kWin: 32,
  kLoss: 32,
  baseOdds: 2.0,
};

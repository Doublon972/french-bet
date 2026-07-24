import { AppSettings } from '../models/settings.model';

/** Probabilité de victoire attendue de l'équipe A face à l'équipe B (formule Elo standard). */
export function expectedScoreA(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

export function averageElo(elos: number[]): number {
  return elos.reduce((s, e) => s + e, 0) / elos.length;
}

/** Cote décimale bornée entre 1.01 et 20, formatée à 2 décimales comme dans l'app d'origine. */
export function computeOdds(prob: number, baseOdds: number): string {
  const oddsMultiplier = baseOdds / 2.0;
  return Math.max(1.01, Math.min((1 / prob) * oddsMultiplier, 20)).toFixed(2);
}

/** Delta Elo appliqué au vainqueur (kWin) et au perdant (kLoss) selon leur probabilité de victoire. */
export function eloDeltaOnWin(kWin: number, prob: number): number {
  return kWin * (1 - prob);
}

export function eloDeltaOnLoss(kLoss: number, prob: number): number {
  return kLoss * (0 - prob);
}

/** Nouvel Elo après application d'un delta, avec un plancher à 100. */
export function applyEloFloor(elo: number, delta: number): number {
  return Math.max(100, elo + delta);
}

export function defaultSettingsFrom(partial: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    baseElo: Number(partial?.baseElo) || 1000,
    kWin: Number(partial?.kWin) || 32,
    kLoss: Number(partial?.kLoss) || 32,
    baseOdds: Number(partial?.baseOdds) || 2.0,
  };
}

import { Component, Input, computed, signal } from '@angular/core';
import { Player } from '../../../core/models';

@Component({
  selector: 'app-match-announce-popup',
  standalone: true,
  templateUrl: './match-announce-popup.component.html',
  host: { class: 'block overlay-pop-in' },
})
export class MatchAnnouncePopupComponent {
  @Input({ required: true }) teamA!: Player[];
  @Input({ required: true }) teamB!: Player[];
  @Input({ required: true }) oddsA!: string;
  @Input({ required: true }) oddsB!: string;

  private readonly probAInput = signal(0.5);
  @Input() set probA(value: number | undefined) {
    this.probAInput.set(value ?? 0.5);
  }

  /** Largeur (%) du côté bleu dans la jauge tug-of-war, bornée pour toujours laisser les deux camps visibles. */
  readonly gaugeSplit = computed(() => Math.round(Math.min(85, Math.max(15, this.probAInput() * 100))));

  names(players: Player[]): string {
    return players.map((p) => p.name).join(' & ');
  }
}

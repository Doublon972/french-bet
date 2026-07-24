import { Component, Input, OnInit, computed } from '@angular/core';
import confetti from 'canvas-confetti';
import { TeamSide } from '../../../core/models/bet.model';

/** Cote à partir de laquelle la victoire est considérée comme un "upset" et déclenche un flash. */
const UPSET_ODDS_THRESHOLD = 2.2;

@Component({
  selector: 'app-victory-popup',
  standalone: true,
  templateUrl: './victory-popup.component.html',
  host: { class: 'block overlay-celebrate-in relative' },
})
export class VictoryPopupComponent implements OnInit {
  @Input({ required: true }) winnerNames!: string;
  @Input({ required: true }) loserNames!: string;
  @Input({ required: true }) winnerSide!: TeamSide;
  @Input({ required: true }) odds!: string;

  readonly isUpset = computed(() => parseFloat(this.odds) >= UPSET_ODDS_THRESHOLD);

  ngOnInit(): void {
    const colors = this.winnerSide === 'A' ? ['#60a5fa', '#3b82f6', '#facc15'] : ['#f87171', '#ef4444', '#facc15'];

    confetti({
      particleCount: 90,
      spread: 70,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.45 },
      colors,
      zIndex: 60,
    });

    if (parseFloat(this.odds) >= UPSET_ODDS_THRESHOLD) {
      confetti({
        particleCount: 50,
        spread: 100,
        startVelocity: 55,
        origin: { x: 0.5, y: 0.45 },
        colors: ['#fbbf24', '#facc15', '#ffffff'],
        zIndex: 60,
      });
    }
  }
}

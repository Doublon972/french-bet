import { Component, Input, OnInit, computed } from '@angular/core';
import confetti from 'canvas-confetti';
import { PlayerPodiumEntry } from '../../../core/utils/overlay.util';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

@Component({
  selector: 'app-player-podium-popup',
  standalone: true,
  templateUrl: './player-podium-popup.component.html',
  host: { class: 'block overlay-celebrate-in' },
})
export class PlayerPodiumPopupComponent implements OnInit {
  @Input({ required: true }) entry!: PlayerPodiumEntry;

  readonly medal = computed(() => MEDALS[this.entry.afterRank] ?? '🏅');

  ngOnInit(): void {
    confetti({
      particleCount: 70,
      spread: 65,
      startVelocity: 40,
      origin: { x: 0.5, y: 0.45 },
      colors: ['#fbbf24', '#facc15', '#fde68a'],
      zIndex: 60,
    });
  }
}

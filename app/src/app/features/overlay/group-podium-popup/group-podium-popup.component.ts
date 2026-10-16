import { Component, Input, OnInit, computed } from '@angular/core';
import confetti from 'canvas-confetti';
import { GroupPodiumEntry } from '../../../core/utils/overlay.util';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

@Component({
  selector: 'app-group-podium-popup',
  standalone: true,
  templateUrl: './group-podium-popup.component.html',
  host: { class: 'block overlay-celebrate-in' },
})
export class GroupPodiumPopupComponent implements OnInit {
  @Input({ required: true }) entry!: GroupPodiumEntry;

  readonly medal = computed(() => MEDALS[this.entry.afterRank] ?? '🏅');

  ngOnInit(): void {
    confetti({
      particleCount: 70,
      spread: 65,
      startVelocity: 40,
      origin: { x: 0.5, y: 0.45 },
      colors: ['#f59e0b', '#fbbf24', '#fde68a'],
      zIndex: 60,
    });
  }
}

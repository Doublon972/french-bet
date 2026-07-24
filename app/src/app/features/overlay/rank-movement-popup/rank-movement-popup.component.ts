import { Component, Input } from '@angular/core';
import { RankMovement } from '../../../core/utils/overlay.util';
import { CountUpComponent } from '../count-up/count-up.component';

@Component({
  selector: 'app-rank-movement-popup',
  standalone: true,
  imports: [CountUpComponent],
  templateUrl: './rank-movement-popup.component.html',
  host: { class: 'block overlay-pop-in' },
})
export class RankMovementPopupComponent {
  @Input({ required: true }) movements!: RankMovement[];

  direction(m: RankMovement): 'up' | 'down' | 'same' {
    if (m.afterRank < m.beforeRank) return 'up';
    if (m.afterRank > m.beforeRank) return 'down';
    return 'same';
  }

  delta(m: RankMovement): number {
    return m.afterElo - m.beforeElo;
  }
}

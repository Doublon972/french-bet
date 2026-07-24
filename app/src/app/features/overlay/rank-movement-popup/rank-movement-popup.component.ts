import { Component, Input } from '@angular/core';
import { RankMovement } from '../../../core/utils/overlay.util';

@Component({
  selector: 'app-rank-movement-popup',
  standalone: true,
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
}

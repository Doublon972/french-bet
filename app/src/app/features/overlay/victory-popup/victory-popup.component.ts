import { Component, Input } from '@angular/core';
import { TeamSide } from '../../../core/models/bet.model';

@Component({
  selector: 'app-victory-popup',
  standalone: true,
  templateUrl: './victory-popup.component.html',
  host: { class: 'block overlay-celebrate-in' },
})
export class VictoryPopupComponent {
  @Input({ required: true }) winnerNames!: string;
  @Input({ required: true }) loserNames!: string;
  @Input({ required: true }) winnerSide!: TeamSide;
  @Input({ required: true }) odds!: string;
}

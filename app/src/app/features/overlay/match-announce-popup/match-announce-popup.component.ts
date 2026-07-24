import { Component, Input } from '@angular/core';
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

  names(players: Player[]): string {
    return players.map((p) => p.name).join(' & ');
  }
}

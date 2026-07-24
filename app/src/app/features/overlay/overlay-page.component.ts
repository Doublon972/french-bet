import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { OverlayEventsService } from '../../core/services/overlay-events.service';
import { EloRecordPopupComponent } from './elo-record-popup/elo-record-popup.component';
import { MatchAnnouncePopupComponent } from './match-announce-popup/match-announce-popup.component';
import { RankMovementPopupComponent } from './rank-movement-popup/rank-movement-popup.component';
import { VictoryPopupComponent } from './victory-popup/victory-popup.component';

/** Classes posées sur <body> par défaut (voir src/index.html) — remplacées par un fond transparent tant que l'overlay est actif. */
const BODY_BG_CLASSES = ['bg-slate-900', 'text-slate-200', 'min-h-screen'];

@Component({
  selector: 'app-overlay-page',
  standalone: true,
  imports: [MatchAnnouncePopupComponent, VictoryPopupComponent, RankMovementPopupComponent, EloRecordPopupComponent],
  templateUrl: './overlay-page.component.html',
  host: { class: 'block' },
})
export class OverlayPageComponent implements OnInit, OnDestroy {
  private readonly eventsService = inject(OverlayEventsService);

  readonly current = this.eventsService.current;
  readonly matchBanner = this.eventsService.matchBanner;

  ngOnInit(): void {
    document.body.classList.remove(...BODY_BG_CLASSES);
    document.body.style.background = 'transparent';
  }

  ngOnDestroy(): void {
    document.body.classList.add(...BODY_BG_CLASSES);
    document.body.style.background = '';
  }
}

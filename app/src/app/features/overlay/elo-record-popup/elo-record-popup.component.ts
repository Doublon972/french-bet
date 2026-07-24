import { Component, Input, OnInit } from '@angular/core';
import confetti from 'canvas-confetti';
import { EloRecord } from '../../../core/utils/overlay.util';
import { CountUpComponent } from '../count-up/count-up.component';

@Component({
  selector: 'app-elo-record-popup',
  standalone: true,
  imports: [CountUpComponent],
  templateUrl: './elo-record-popup.component.html',
  host: { class: 'block overlay-celebrate-in' },
})
export class EloRecordPopupComponent implements OnInit {
  @Input({ required: true }) record!: EloRecord;

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

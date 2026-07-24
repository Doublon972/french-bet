import { Component, Input } from '@angular/core';
import { EloRecord } from '../../../core/utils/overlay.util';

@Component({
  selector: 'app-elo-record-popup',
  standalone: true,
  templateUrl: './elo-record-popup.component.html',
  host: { class: 'block overlay-celebrate-in' },
})
export class EloRecordPopupComponent {
  @Input({ required: true }) record!: EloRecord;
}

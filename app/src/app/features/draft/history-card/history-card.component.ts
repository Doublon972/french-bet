import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HistoryEntry } from '../../../core/models';

@Component({
  selector: 'app-history-card',
  standalone: true,
  templateUrl: './history-card.component.html',
})
export class HistoryCardComponent {
  @Input() history: HistoryEntry[] = [];
  @Input() isAdmin = false;

  @Output() selectMatch = new EventEmitter<HistoryEntry>();
  @Output() closeSession = new EventEmitter<void>();
}

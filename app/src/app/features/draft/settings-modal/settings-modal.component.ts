import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppSettings } from '../../../core/models';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings-modal.component.html',
})
export class SettingsModalComponent implements OnInit {
  @Input({ required: true }) settings!: AppSettings;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<AppSettings>();

  baseElo = 1000;
  baseOdds = 2.0;
  kWin = 32;
  kLoss = 32;

  ngOnInit(): void {
    this.baseElo = this.settings.baseElo;
    this.baseOdds = this.settings.baseOdds;
    this.kWin = this.settings.kWin;
    this.kLoss = this.settings.kLoss;
  }

  submit(): void {
    this.save.emit({
      baseElo: Number(this.baseElo) || 1000,
      baseOdds: Number(this.baseOdds) || 2.0,
      kWin: Number(this.kWin) || 32,
      kLoss: Number(this.kLoss) || 32,
    });
  }
}

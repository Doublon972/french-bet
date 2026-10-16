import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-roster-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-sm fade-in">
      <h2 class="text-lg font-semibold mb-4 text-emerald-400 flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
        Nouveau Combattant
      </h2>
      <div class="flex gap-2">
        <input
          type="text"
          [(ngModel)]="name"
          (keydown.enter)="submit()"
          placeholder="Pseudo..."
          class="w-full p-3 rounded-xl bg-slate-900/50 text-white border border-slate-700 focus:outline-none focus:border-emerald-500 transition"
        />
        <button
          (click)="submit()"
          class="bg-emerald-500 hover:bg-emerald-600 px-5 rounded-xl font-bold transition shadow-lg shadow-emerald-500/20 text-white"
        >
          +
        </button>
      </div>
    </div>
  `,
})
export class RosterFormComponent {
  @Output() addPlayer = new EventEmitter<string>();

  name = '';

  submit(): void {
    const trimmed = this.name.trim();
    if (trimmed === '') return;
    this.addPlayer.emit(trimmed);
    this.name = '';
  }
}

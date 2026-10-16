import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';

/**
 * Anime un nombre de `from` à `to` une seule fois au montage du composant (easing ease-out),
 * pour un effet "compteur qui défile" plutôt qu'une valeur qui apparaît d'un coup.
 */
@Component({
  selector: 'app-count-up',
  standalone: true,
  template: `{{ display() }}`,
  host: { class: 'inline-block tabular-nums' },
})
export class CountUpComponent implements OnInit, OnDestroy {
  @Input() from = 0;
  @Input({ required: true }) to!: number;
  @Input() durationMs = 900;
  @Input() prefix = '';
  @Input() suffix = '';

  private rafId: number | null = null;

  readonly display = signal('');

  ngOnInit(): void {
    const start = performance.now();
    const from = this.from;
    const to = this.to;
    const span = to - from;

    if (span === 0 || this.durationMs <= 0) {
      this.setValue(to);
      return;
    }

    const tick = (now: number): void => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / this.durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.setValue(Math.round(from + span * eased));
      if (t < 1) {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private setValue(value: number): void {
    this.display.set(`${this.prefix}${value}${this.suffix}`);
  }
}

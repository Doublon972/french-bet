import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Player } from '../../../core/models';

export type DraftColumn = 'available' | 'teamA' | 'teamB';

@Component({
  selector: 'app-draft-board',
  standalone: true,
  imports: [DragDropModule, FormsModule],
  templateUrl: './draft-board.component.html',
})
export class DraftBoardComponent {
  @Input() isAdmin = false;
  @Output() draftChange = new EventEmitter<{ teamA: string[]; teamB: string[] }>();
  @Output() createMatch = new EventEmitter<void>();

  readonly searchTerm = signal('');

  private readonly playersById = signal<Map<string, Player>>(new Map());
  readonly teamAIds = signal<string[]>([]);
  readonly teamBIds = signal<string[]>([]);
  private readonly allPlayerIdsSorted = signal<string[]>([]);

  @Input() set players(value: Player[] | undefined) {
    const list = value ?? [];
    const map = new Map(list.map((p) => [p.id, p]));
    this.playersById.set(map);
    this.allPlayerIdsSorted.set(
      [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })).map((p) => p.id),
    );
  }

  @Input() set draftTeamA(value: string[] | undefined) {
    this.teamAIds.set(value ?? []);
  }

  @Input() set draftTeamB(value: string[] | undefined) {
    this.teamBIds.set(value ?? []);
  }

  readonly availableIds = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const a = new Set(this.teamAIds());
    const b = new Set(this.teamBIds());
    const byId = this.playersById();
    return this.allPlayerIdsSorted().filter((id) => {
      if (a.has(id) || b.has(id)) return false;
      const player = byId.get(id);
      return !!player && player.name.toLowerCase().includes(search);
    });
  });

  readonly teamACards = computed(() => this.resolvePlayers(this.teamAIds()));
  readonly teamBCards = computed(() => this.resolvePlayers(this.teamBIds()));
  readonly availableCards = computed(() => this.resolvePlayers(this.availableIds()));

  private resolvePlayers(ids: string[]): Player[] {
    const byId = this.playersById();
    return ids.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  }

  initials(name: string): string {
    return name.substring(0, 2).toUpperCase();
  }

  round(elo: number): number {
    return Math.round(elo);
  }

  drop(event: CdkDragDrop<Player[]>): void {
    if (!this.isAdmin) return;

    const listFor = (col: DraftColumn): string[] =>
      col === 'teamA' ? [...this.teamAIds()] : col === 'teamB' ? [...this.teamBIds()] : [];

    const fromCol = event.previousContainer.id as DraftColumn;
    const toCol = event.container.id as DraftColumn;

    if (fromCol === toCol) {
      if (fromCol === 'available') return;
      const list = listFor(fromCol);
      moveItemInArray(list, event.previousIndex, event.currentIndex);
      this.applyLists(toCol === 'teamA' ? list : this.teamAIds(), toCol === 'teamB' ? list : this.teamBIds());
      return;
    }

    const fromList = fromCol === 'available' ? [...this.availableIds()] : listFor(fromCol);
    const toList = toCol === 'available' ? [...this.availableIds()] : listFor(toCol);
    transferArrayItem(fromList, toList, event.previousIndex, event.currentIndex);

    let newTeamA = this.teamAIds();
    let newTeamB = this.teamBIds();
    if (fromCol === 'teamA') newTeamA = fromList;
    if (fromCol === 'teamB') newTeamB = fromList;
    if (toCol === 'teamA') newTeamA = toList;
    if (toCol === 'teamB') newTeamB = toList;

    this.applyLists(newTeamA, newTeamB);
  }

  private applyLists(teamA: string[], teamB: string[]): void {
    this.teamAIds.set(teamA);
    this.teamBIds.set(teamB);
    this.draftChange.emit({ teamA, teamB });
  }
}

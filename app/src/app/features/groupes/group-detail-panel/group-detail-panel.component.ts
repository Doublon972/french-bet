import { Component, Input, computed, signal } from '@angular/core';
import { HistoryEntry } from '../../../core/models';
import { stripGroupPrefix } from '../../../core/utils/groups.util';
import { GroupEloChartComponent } from '../group-elo-chart/group-elo-chart.component';
import { GroupMatchHistoryComponent } from '../group-match-history/group-match-history.component';
import { GroupStats, RankedGroup, computeGroupStats, matchInvolvesGroup } from '../groupes.util';

@Component({
  selector: 'app-group-detail-panel',
  standalone: true,
  imports: [GroupEloChartComponent, GroupMatchHistoryComponent],
  templateUrl: './group-detail-panel.component.html',
})
export class GroupDetailPanelComponent {
  private readonly groupInput = signal<RankedGroup | null>(null);
  @Input() set group(value: RankedGroup | null) {
    this.groupInput.set(value);
  }

  private readonly totalGroupCountInput = signal(0);
  @Input() set totalGroupCount(value: number | undefined) {
    this.totalGroupCountInput.set(value ?? 0);
  }

  private readonly allMatchesInput = signal<HistoryEntry[]>([]);
  @Input() set allMatches(value: HistoryEntry[] | undefined) {
    this.allMatchesInput.set(value ?? []);
  }

  readonly currentGroup = computed(() => this.groupInput());

  readonly initials = computed(() => this.currentGroup()?.name.substring(0, 2).toUpperCase() ?? '');

  readonly rankText = computed(() => {
    const g = this.currentGroup();
    if (!g) return '';
    return `${g.rank}${g.rank === 1 ? 'er' : 'ème'} sur ${this.totalGroupCountInput()} groupes`;
  });

  readonly avgEloRounded = computed(() => Math.round(this.currentGroup()?.avgElo ?? 0));

  readonly membersCount = computed(() => this.currentGroup()?.members.length ?? 0);

  readonly sortedMembers = computed(() => {
    const g = this.currentGroup();
    if (!g) return [];
    return [...g.members]
      .sort((a, b) => b.elo - a.elo)
      .map((m) => ({ ...m, displayName: stripGroupPrefix(m.name, g.name), roundedElo: Math.round(m.elo) }));
  });

  readonly groupMatches = computed(() => {
    const g = this.currentGroup();
    if (!g) return [];
    return this.allMatchesInput().filter((m) => matchInvolvesGroup(g, m));
  });

  readonly stats = computed<GroupStats>(() => {
    const g = this.currentGroup();
    return g ? computeGroupStats(g, this.groupMatches()) : { realTotalGames: 0, winrate: 0 };
  });
}

import { Component, computed, inject, signal } from '@angular/core';
import { HeaderComponent } from '../../shared/header/header.component';
import { HistoryService } from '../../core/services/history.service';
import { PlayersService } from '../../core/services/players.service';
import { buildGroups, rankByAvgElo } from '../../core/utils/groups.util';
import { GroupDetailPanelComponent } from './group-detail-panel/group-detail-panel.component';
import { GroupLeaderboardComponent } from './group-leaderboard/group-leaderboard.component';
import { RankedGroup } from './groupes.util';

@Component({
  selector: 'app-groupes-page',
  standalone: true,
  imports: [HeaderComponent, GroupLeaderboardComponent, GroupDetailPanelComponent],
  templateUrl: './groupes-page.component.html',
})
export class GroupesPageComponent {
  private readonly playersService = inject(PlayersService);
  private readonly historyService = inject(HistoryService);

  readonly allMatches = this.historyService.allMatches;

  readonly rankedGroups = computed<RankedGroup[]>(() =>
    rankByAvgElo(buildGroups(this.playersService.players() ?? [])),
  );

  readonly selectedGroupId = signal<string | null>(null);

  readonly selectedGroup = computed<RankedGroup | null>(() => {
    const id = this.selectedGroupId();
    if (!id) return null;
    return this.rankedGroups().find((g) => g.id === id) ?? null;
  });

  selectGroup(id: string): void {
    this.selectedGroupId.set(id);
  }
}

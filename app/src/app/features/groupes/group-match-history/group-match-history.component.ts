import { Component, Input, computed, signal } from '@angular/core';
import { Group, HistoryEntry } from '../../../core/models';
import { formatTeamForGroup, groupInSide } from '../groupes.util';

type MatchStatus = 'victoire' | 'defaite' | 'guerre' | null;

interface MatchHistoryRow {
  id: string;
  dateStr: string;
  teamAHtml: string;
  teamBHtml: string;
  teamAClass: string;
  teamBClass: string;
  borderClass: string;
  status: MatchStatus;
}

@Component({
  selector: 'app-group-match-history',
  standalone: true,
  templateUrl: './group-match-history.component.html',
})
export class GroupMatchHistoryComponent {
  private readonly groupInput = signal<Group | null>(null);
  @Input() set group(value: Group | null) {
    this.groupInput.set(value);
  }

  private readonly matchesInput = signal<HistoryEntry[]>([]);
  @Input() set groupMatches(value: HistoryEntry[] | undefined) {
    this.matchesInput.set(value ?? []);
  }

  readonly rows = computed<MatchHistoryRow[]>(() => {
    const group = this.groupInput();
    if (!group) return [];
    return [...this.matchesInput()].reverse().map((m) => this.buildRow(group, m));
  });

  private buildRow(group: Group, m: HistoryEntry): MatchHistoryRow {
    const dateStr = new Date(m.timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const groupInA = groupInSide(group, m, 'A');
    const groupInB = groupInSide(group, m, 'B');

    let borderClass = 'border-slate-700/50';
    let status: MatchStatus = null;

    if (groupInA && !groupInB) {
      if (m.winner === 'A') {
        borderClass = 'border-emerald-500/40 bg-emerald-900/20';
        status = 'victoire';
      } else {
        borderClass = 'border-red-500/40 bg-red-900/20';
        status = 'defaite';
      }
    } else if (!groupInA && groupInB) {
      if (m.winner === 'B') {
        borderClass = 'border-emerald-500/40 bg-emerald-900/20';
        status = 'victoire';
      } else {
        borderClass = 'border-red-500/40 bg-red-900/20';
        status = 'defaite';
      }
    } else if (groupInA && groupInB) {
      borderClass = 'border-amber-500/40 bg-amber-900/10';
      status = 'guerre';
    }

    return {
      id: m.id,
      dateStr,
      teamAHtml: formatTeamForGroup(m.teamA_names, group),
      teamBHtml: formatTeamForGroup(m.teamB_names, group),
      teamAClass: m.winner === 'A' ? 'text-slate-200 font-bold' : 'text-slate-500',
      teamBClass: m.winner === 'B' ? 'text-slate-200 font-bold' : 'text-slate-500',
      borderClass,
      status,
    };
  }
}

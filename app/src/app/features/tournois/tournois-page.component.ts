import { Component, computed, inject, signal } from '@angular/core';
import { TournamentService } from './tournament.service';
import { Tournament, TournamentGroup, TournamentMatch } from './tournament.model';
import { FormsModule } from '@angular/forms';
import { TournamentBracketComponent } from './tournament-bracket/tournament-bracket.component';
import { PlayersService } from '../../core/services/players.service';
import { Player } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { averageElo, computeOdds, expectedScoreA } from '../../core/utils/elo.util';
import { tournamentTeamLabel } from './tournament.util';

@Component({
  selector: 'app-tournois-page',
  standalone: true,
  imports: [FormsModule, TournamentBracketComponent],
  templateUrl: './tournois-page.component.html',
})
export class TournoisPageComponent {
  private readonly tournamentService = inject(TournamentService);
  private readonly playersService = inject(PlayersService);
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);

  readonly tournaments = this.tournamentService.tournaments;
  readonly currentTournament = this.tournamentService.currentTournament;
  readonly players = computed<Player[]>(() => this.playersService.players() ?? []);

  readonly isAdmin = this.authService.isAdmin;

  // Formulaire de création
  readonly tournamentName = signal('');
  readonly participantsPerGroup = signal(2);

  // Formulaire des participants
  readonly groups = signal<TournamentGroup[]>([]);
  readonly participantSearches = signal<Record<string, string>>({});

  // Vue
  readonly currentView = signal<'list' | 'create' | 'participants' | 'bracket'>('list');
  readonly fightSides = ['A', 'B'] as const;
  readonly orderedFights = computed(() => {
    const bracket = this.currentTournament()?.bracket;
    return bracket ? this.collectFights(bracket) : [];
  });
  readonly nextFight = computed(
    () => this.orderedFights().find((fight) => fight.participant1 && fight.participant2 && !fight.winner) ?? null,
  );

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('fr-FR');
  }

  openCreateForm(): void {
    this.currentView.set('create');
    this.tournamentName.set('');
    this.participantsPerGroup.set(2);
  }

  startParticipantsForm(): void {
    const name = this.tournamentName().trim();
    if (!name) {
      alert('Veuillez entrer un nom pour le tournoi');
      return;
    }

    const numParticipants = Number(this.participantsPerGroup());
    if (!Number.isInteger(numParticipants) || numParticipants < 1 || numParticipants > 20) {
      alert('Chaque équipe doit contenir entre 1 et 20 combattants.');
      return;
    }
    this.participantsPerGroup.set(numParticipants);

    const newGroups: TournamentGroup[] = [
      {
        id: this.newGroupId(),
        name: '',
        participants: Array(numParticipants).fill(''),
      },
      {
        id: this.newGroupId(),
        name: '',
        participants: Array(numParticipants).fill(''),
      },
    ];

    this.groups.set(newGroups);
    this.currentView.set('participants');
  }

  addGroup(): void {
    const numParticipants = this.participantsPerGroup();
    const currentGroups = this.groups();
    const newGroup: TournamentGroup = {
      id: this.newGroupId(),
      name: '',
      participants: Array(numParticipants).fill(''),
    };
    this.groups.set([...currentGroups, newGroup]);
  }

  removeGroup(index: number): void {
    const currentGroups = this.groups();
    if (currentGroups.length <= 2) {
      alert('Il faut au minimum 2 équipes pour créer un tournoi');
      return;
    }
    this.groups.set(currentGroups.filter((_, i) => i !== index));
  }

  participantSearchKey(groupId: string, participantIndex: number): string {
    return `${groupId}:${participantIndex}`;
  }

  participantSearchText(groupId: string, participantIndex: number): string {
    return this.participantSearches()[this.participantSearchKey(groupId, participantIndex)] ?? '';
  }

  setParticipantSearch(groupId: string, participantIndex: number, value: string): void {
    const key = this.participantSearchKey(groupId, participantIndex);
    this.participantSearches.set({ ...this.participantSearches(), [key]: value });
  }

  matchingPlayers(groupId: string, participantIndex: number): Player[] {
    const query = this.normalizeSearch(this.participantSearchText(groupId, participantIndex));
    const selectedIds = new Set(this.groups().flatMap((group) => group.participants).filter(Boolean));
    return this.players()
      .filter(
        (player) =>
          !selectedIds.has(player.id) ||
          this.groups().some((group) => group.id === groupId && group.participants[participantIndex] === player.id),
      )
      .filter((player) => !query || this.normalizeSearch(player.name).includes(query))
      .sort((left, right) => left.name.localeCompare(right.name, 'fr'))
      .slice(0, 8);
  }

  selectParticipant(groupId: string, participantIndex: number, player: Player): void {
    this.groups.set(
      this.groups().map((group) =>
        group.id === groupId
          ? {
              ...group,
              participants: group.participants.map((participant, index) =>
                index === participantIndex ? player.id : participant,
              ),
            }
          : group,
      ),
    );
    this.setParticipantSearch(groupId, participantIndex, '');
  }

  removeParticipant(groupId: string, participantIndex: number): void {
    this.groups.set(
      this.groups().map((group) =>
        group.id === groupId
          ? {
              ...group,
              participants: group.participants.map((participant, index) => (index === participantIndex ? '' : participant)),
            }
          : group,
      ),
    );
  }

  updateGroupName(groupId: string, value: string): void {
    this.groups.set(this.groups().map((group) => (group.id === groupId ? { ...group, name: value } : group)));
  }

  createTournament(): void {
    const name = this.tournamentName().trim();
    if (!name) {
      alert('Veuillez entrer un nom pour le tournoi');
      return;
    }

    const groups = this.groups();
    if (groups.length < 2 || groups.some((group) => group.participants.some((id) => !id))) {
      alert('Chaque équipe doit avoir tous ses combattants sélectionnés.');
      return;
    }

    const selectedIds = groups.flatMap((group) => group.participants);
    if (new Set(selectedIds).size !== selectedIds.length) {
      alert('Un combattant ne peut être inscrit que dans une seule équipe.');
      return;
    }
    const registeredIds = new Set(this.players().map((player) => player.id));
    if (selectedIds.some((id) => !registeredIds.has(id))) {
      alert('Un combattant sélectionné n’existe plus dans la liste des combattants.');
      return;
    }

    this.tournamentService.createTournament(name, groups);
    this.currentView.set('list');
  }

  selectTournament(tournament: Tournament): void {
    this.tournamentService.selectTournament(tournament);
    this.currentView.set('bracket');
  }

  teamLabel(tournament: Tournament, teamId: string): string {
    const group = tournament.groups.find((candidate) => candidate.id === teamId);
    return group ? tournamentTeamLabel(group, this.players()) : teamId;
  }

  playerById(id: string): Player | undefined {
    return this.players().find((player) => player.id === id);
  }

  teamOdds(tournament: Tournament, match: TournamentMatch, side: 'A' | 'B'): string {
    const teamId = side === 'A' ? match.participant1 : match.participant2;
    const otherTeamId = side === 'A' ? match.participant2 : match.participant1;
    if (!teamId || !otherTeamId) return '-';
    const probability = expectedScoreA(this.teamElo(tournament, teamId), this.teamElo(tournament, otherTeamId));
    return computeOdds(side === 'A' ? probability : 1 - probability, this.settingsService.settings().baseOdds);
  }

  teamChance(tournament: Tournament, match: TournamentMatch, side: 'A' | 'B'): string {
    const teamId = side === 'A' ? match.participant1 : match.participant2;
    const otherTeamId = side === 'A' ? match.participant2 : match.participant1;
    if (!teamId || !otherTeamId) return '0';
    const probability = expectedScoreA(this.teamElo(tournament, teamId), this.teamElo(tournament, otherTeamId));
    return ((side === 'A' ? probability : 1 - probability) * 100).toFixed(0);
  }

  chooseWinner(match: TournamentMatch, winner: string): void {
    if (!this.isAdmin() || this.nextFight()?.id !== match.id) return;
    this.tournamentService.updateMatchWinner(match.id, winner);
  }

  isNextFight(match: TournamentMatch): boolean {
    return this.nextFight()?.id === match.id;
  }

  deleteTournament(tournamentId: string): void {
    if (!confirm('Voulez-vous vraiment supprimer ce tournoi ?')) return;
    this.tournamentService.deleteTournament(tournamentId);
    this.currentView.set('list');
  }

  goBackToList(): void {
    this.currentView.set('list');
    this.tournamentService.currentTournament.set(null);
  }

  goToCreate(): void {
    this.currentView.set('create');
  }

  goToParticipants(): void {
    this.currentView.set('participants');
  }

  private collectFights(match: TournamentMatch): TournamentMatch[] {
    const fightsByDepth = new Map<number, TournamentMatch[]>();
    const collect = (current: TournamentMatch, depth: number): void => {
      if (current.children) {
        for (const child of current.children) {
          if (child) collect(child, depth + 1);
        }
      }
      const roundFights = fightsByDepth.get(depth) ?? [];
      roundFights.push(current);
      fightsByDepth.set(depth, roundFights);
    };
    collect(match, 0);
    return [...fightsByDepth.entries()]
      .sort(([leftDepth], [rightDepth]) => rightDepth - leftDepth)
      .flatMap(([, roundFights]) => roundFights);
  }

  private teamElo(tournament: Tournament, teamId: string): number {
    const group = tournament.groups.find((candidate) => candidate.id === teamId);
    if (!group) return 1000;
    const elos = group.participants
      .map((id) => this.players().find((player) => player.id === id)?.elo)
      .filter((elo): elo is number => elo !== undefined);
    return elos.length ? averageElo(elos) : 1000;
  }

  private newGroupId(): string {
    return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase('fr')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PlayersService } from '../../core/services/players.service';
import { SettingsService } from '../../core/services/settings.service';
import { Player } from '../../core/models';
import { averageElo, computeOdds, expectedScoreA } from '../../core/utils/elo.util';
import { TournamentService } from './tournament.service';
import { Tournament, TournamentGroup, TournamentMatch } from './tournament.model';
import { tournamentTeamLabel } from './tournament.util';
import { TournamentBracketComponent } from './tournament-bracket/tournament-bracket.component';

interface MatchRound {
  name: string;
  matches: TournamentMatch[];
}

@Component({
  selector: 'app-tournois-page',
  standalone: true,
  imports: [FormsModule, TournamentBracketComponent],
  templateUrl: './tournois-page.component.html',
})
export class TournoisPageComponent {
  private readonly tournamentService = inject(TournamentService);
  private readonly playersService = inject(PlayersService);
  private readonly settingsService = inject(SettingsService);
  private readonly authService = inject(AuthService);

  readonly tournaments = this.tournamentService.tournaments;
  readonly currentTournament = this.tournamentService.currentTournament;
  readonly players = computed<Player[]>(() => this.playersService.players() ?? []);
  readonly isAdmin = this.authService.isAdmin;
  readonly matchRounds = computed(() => this.extractMatchRounds(this.currentTournament()?.bracket ?? null));

  readonly showCreateForm = signal(false);
  readonly tournamentName = signal('');
  readonly participantsPerGroup = signal(2);
  readonly groups = signal<TournamentGroup[]>([]);
  readonly currentView = signal<'list' | 'create' | 'participants' | 'bracket'>('list');
  readonly activeParticipantField = signal<string | null>(null);
  readonly participantSearch = signal<Record<string, string>>({});

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('fr-FR');
  }

  openCreateForm(): void {
    this.currentView.set('create');
    this.showCreateForm.set(true);
    this.tournamentName.set('');
    this.participantsPerGroup.set(2);
  }

  startParticipantsForm(): void {
    const name = this.tournamentName().trim();
    if (!name) {
      alert('Veuillez entrer un nom pour le tournoi');
      return;
    }

    const teamSize = Number(this.participantsPerGroup());
    if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 20) {
      alert('Le nombre de combattants par équipe doit être compris entre 1 et 20.');
      return;
    }

    this.groups.set([this.createGroup(0, teamSize), this.createGroup(1, teamSize)]);
    this.currentView.set('participants');
  }

  private createGroup(index: number, teamSize: number): TournamentGroup {
    return {
      id: `group-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      name: '',
      participants: Array(teamSize).fill(''),
    };
  }

  addGroup(): void {
    const currentGroups = this.groups();
    this.groups.set([...currentGroups, this.createGroup(currentGroups.length, Number(this.participantsPerGroup()))]);
  }

  removeGroup(index: number): void {
    const currentGroups = this.groups();
    if (currentGroups.length <= 2) {
      alert('Il faut au minimum 2 équipes pour créer un tournoi');
      return;
    }
    this.groups.set(currentGroups.filter((_, i) => i !== index));
  }

  participantFieldId(groupIndex: number, participantIndex: number): string {
    return `${this.groups()[groupIndex]?.id}-${participantIndex}`;
  }

  participantInputValue(groupIndex: number, participantIndex: number): string {
    const fieldId = this.participantFieldId(groupIndex, participantIndex);
    if (this.activeParticipantField() === fieldId) {
      return this.participantSearch()[fieldId] ?? '';
    }
    return this.players().find((player) => player.id === this.groups()[groupIndex]?.participants[participantIndex])?.name ?? '';
  }

  focusParticipantSearch(groupIndex: number, participantIndex: number): void {
    const fieldId = this.participantFieldId(groupIndex, participantIndex);
    const selectedId = this.groups()[groupIndex]?.participants[participantIndex];
    const selectedName = this.players().find((player) => player.id === selectedId)?.name ?? '';
    this.activeParticipantField.set(fieldId);
    this.participantSearch.update((queries) => ({ ...queries, [fieldId]: selectedName }));
  }

  updateParticipantSearch(groupIndex: number, participantIndex: number, query: string): void {
    const fieldId = this.participantFieldId(groupIndex, participantIndex);
    this.activeParticipantField.set(fieldId);
    this.participantSearch.update((queries) => ({ ...queries, [fieldId]: query }));

    const updatedGroups = this.groups().map((group, index) => {
      if (index !== groupIndex) return group;
      const participants = [...group.participants];
      participants[participantIndex] = '';
      return { ...group, participants };
    });
    this.groups.set(updatedGroups);
  }

  participantSuggestions(groupIndex: number, participantIndex: number): Player[] {
    const fieldId = this.participantFieldId(groupIndex, participantIndex);
    const query = this.normalizeSearch(this.participantSearch()[fieldId] ?? '');
    const alreadySelected = new Set(
      this.groups().flatMap((group, currentGroupIndex) =>
        group.participants
          .filter((_, currentParticipantIndex) => currentGroupIndex !== groupIndex || currentParticipantIndex !== participantIndex),
      ),
    );

    return this.players()
      .filter((player) => !alreadySelected.has(player.id) && this.normalizeSearch(player.name).includes(query))
      .sort((a, b) => {
        const aStartsWithQuery = this.normalizeSearch(a.name).startsWith(query);
        const bStartsWithQuery = this.normalizeSearch(b.name).startsWith(query);
        return Number(bStartsWithQuery) - Number(aStartsWithQuery) || a.name.localeCompare(b.name, 'fr');
      });
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  selectParticipant(groupIndex: number, participantIndex: number, player: Player): void {
    const updatedGroups = this.groups().map((group, index) => {
      if (index !== groupIndex) return group;
      const participants = [...group.participants];
      participants[participantIndex] = player.id;
      return { ...group, participants };
    });
    this.groups.set(updatedGroups);
    this.activeParticipantField.set(null);
  }

  updateGroupName(groupIndex: number, value: string): void {
    this.groups.update((groups) =>
      groups.map((group, index) => (index === groupIndex ? { ...group, name: value } : group)),
    );
  }

  createTournament(): void {
    const name = this.tournamentName().trim();
    if (!name) {
      alert('Veuillez entrer un nom pour le tournoi');
      return;
    }

    const groups = this.groups();
    const allParticipants = groups.flatMap((group) => group.participants);
    if (groups.length < 2 || allParticipants.some((id) => !id)) {
      alert('Sélectionnez un combattant enregistré pour chaque place de chaque équipe.');
      return;
    }

    const uniqueParticipants = new Set(allParticipants);
    if (uniqueParticipants.size !== allParticipants.length) {
      alert('Un combattant ne peut être sélectionné qu’une seule fois dans le tournoi.');
      return;
    }
    if (allParticipants.some((id) => !this.players().some((player) => player.id === id))) {
      alert('Un combattant sélectionné n’existe plus dans la base de données. Veuillez le sélectionner à nouveau.');
      return;
    }

    this.tournamentService.createTournament(name, groups);
    this.currentView.set('bracket');
  }

  selectTournament(tournament: Tournament): void {
    this.tournamentService.selectTournament(tournament);
    this.currentView.set('bracket');
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

  teamLabel(tournament: Tournament, groupId: string | undefined): string {
    const group = tournament.groups.find((candidate) => candidate.id === groupId);
    return group ? tournamentTeamLabel(group, this.players()) : 'En attente';
  }

  matchOdds(tournament: Tournament, match: TournamentMatch, side: 'A' | 'B'): string | null {
    const groupId = side === 'A' ? match.participant1 : match.participant2;
    const group = tournament.groups.find((candidate) => candidate.id === groupId);
    if (!group) return null;

    const teamPlayers = group.participants.map((id) => this.players().find((player) => player.id === id));
    const resolvedTeam = teamPlayers.filter((player): player is Player => !!player);
    if (resolvedTeam.length !== group.participants.length || resolvedTeam.length === 0) return null;

    const otherGroupId = side === 'A' ? match.participant2 : match.participant1;
    const otherGroup = tournament.groups.find((candidate) => candidate.id === otherGroupId);
    if (!otherGroup) return null;
    const otherPlayers = otherGroup.participants.map((id) => this.players().find((player) => player.id === id));
    const resolvedOtherTeam = otherPlayers.filter((player): player is Player => !!player);
    if (resolvedOtherTeam.length !== otherGroup.participants.length || resolvedOtherTeam.length === 0) return null;

    const eloA = averageElo(resolvedTeam.map((player) => player.elo));
    const eloB = averageElo(resolvedOtherTeam.map((player) => player.elo));
    const probA = expectedScoreA(eloA, eloB);
    const probability = side === 'A' ? probA : 1 - probA;
    return computeOdds(probability, this.settingsService.settings().baseOdds);
  }

  setMatchWinner(match: TournamentMatch, winner: string): void {
    if (!this.isAdmin() || !match.participant1 || !match.participant2 || match.winner) return;
    this.tournamentService.updateMatchWinner(match.id, winner);
  }

  private extractMatchRounds(bracket: TournamentMatch | null): MatchRound[] {
    if (!bracket) return [];
    const byDepth = new Map<number, MatchRound>();
    const visit = (match: TournamentMatch, depth: number): void => {
      if (!match.isBye) {
        const round = byDepth.get(depth) ?? { name: match.round, matches: [] };
        round.matches.push(match);
        byDepth.set(depth, round);
      }
      match.children?.forEach((child) => visit(child, depth + 1));
    };
    visit(bracket, 0);
    return [...byDepth.entries()].sort(([depthA], [depthB]) => depthB - depthA).map(([, round]) => round);
  }
}

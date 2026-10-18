import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { MatchService } from '../../core/services/match.service';
import { PlayersService } from '../../core/services/players.service';
import { SettingsService } from '../../core/services/settings.service';
import { ActiveMatch, HistoryEntry, Player } from '../../core/models';
import { TeamSide } from '../../core/models/bet.model';
import { averageElo, computeOdds, expectedScoreA } from '../../core/utils/elo.util';
import { ActiveMatchPanelComponent } from '../draft/active-match-panel/active-match-panel.component';
import { MatchDetailModalComponent } from '../draft/match-detail-modal/match-detail-modal.component';
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
  imports: [FormsModule, RouterLink, TournamentBracketComponent, ActiveMatchPanelComponent, MatchDetailModalComponent],
  templateUrl: './tournois-page.component.html',
})
export class TournoisPageComponent implements OnInit {
  private readonly tournamentService = inject(TournamentService);
  private readonly historyService = inject(HistoryService);
  private readonly matchService = inject(MatchService);
  private readonly playersService = inject(PlayersService);
  private readonly settingsService = inject(SettingsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/']);
    }
  }

  readonly tournaments = computed(() => this.tournamentService.tournaments() ?? []);
  readonly currentTournament = this.tournamentService.currentTournament;
  readonly players = computed<Player[]>(() => this.playersService.players() ?? []);
  readonly isAdmin = this.authService.isAdmin;
  readonly activeMatch = this.matchService.activeMatch;
  readonly matchRounds = computed(() => this.extractMatchRounds(this.currentTournament()?.bracket ?? null));
  readonly currentTournamentMatch = computed(
    () => this.matchRounds().flatMap((round) => round.matches).find((match) => !match.winner) ?? null,
  );
  readonly activeTournamentMatch = computed<ActiveMatch | null>(() => {
    const tournament = this.currentTournament();
    const match = this.currentTournamentMatch();
    const active = this.activeMatch();
    return tournament &&
      match &&
      active?.tournamentId === tournament.id &&
      active.tournamentMatchId === match.id
      ? active
      : null;
  });
  readonly selectedMatchId = signal<string | null>(null);
  readonly selectedMatch = computed<HistoryEntry | null>(() => {
    const id = this.selectedMatchId();
    return id ? this.historyService.allMatches().find((match) => match.id === id) ?? null : null;
  });
  readonly selectedTournamentMatch = signal<TournamentMatch | null>(null);

  readonly showCreateForm = signal(false);
  readonly tournamentName = signal('');
  readonly participantsPerGroup = signal(2);
  readonly groups = signal<TournamentGroup[]>([]);
  readonly currentView = signal<'list' | 'create' | 'edit' | 'participants' | 'bracket'>('list');
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

  async createTournament(): Promise<void> {
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

    try {
      const tournament = await this.tournamentService.createTournament(name, teamSize);
      this.tournamentService.selectTournament(tournament);
      this.groups.set([this.createGroup(0, teamSize), this.createGroup(1, teamSize)]);
      this.currentView.set('edit');
    } catch (error) {
      console.error('Erreur lors de la création du tournoi', error);
      alert('Impossible de créer le tournoi. Vérifiez votre connexion et réessayez.');
    }
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

  async createTournament(): Promise<void> {
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

    await this.tournamentService.createTournament(name, groups);
    this.currentView.set('bracket');
  }

  async finalizeTournament(): Promise<void> {
    const tournament = this.currentTournament();
    if (!tournament) return;

    const groups = this.groups();
    const allParticipants = groups.flatMap((group) => group.participants);
    if (groups.length < 2 || allParticipants.some((id) => !id)) {
      alert('Sélectionnez un combattant enregistré pour chaque place de chaque équipe.');
      return;
    }

    const uniqueParticipants = new Set(allParticipants);
    if (uniqueParticipants.size !== allParticipants.length) {
      alert('Un combattant ne peut être sélectionné qu\'une seule fois dans le tournoi.');
      return;
    }
    if (allParticipants.some((id) => !this.players().some((player) => player.id === id))) {
      alert('Un combattant sélectionné n\'existe plus dans la base de données. Veuillez le sélectionner à nouveau.');
      return;
    }

    try {
      await this.tournamentService.finalizeTournament(tournament.id, groups);
      this.currentView.set('bracket');
    } catch (error) {
      console.error('Erreur lors de la finalisation du tournoi', error);
      alert('Impossible de finaliser le tournoi. Vérifiez votre connexion et réessayez.');
    }
  }

  async saveGroups(): Promise<void> {
    const tournament = this.currentTournament();
    if (!tournament) return;

    try {
      await this.tournamentService.updateTournamentGroups(tournament.id, this.groups());
      alert('Groupes sauvegardés avec succès !');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des groupes', error);
      alert('Impossible de sauvegarder les groupes. Vérifiez votre connexion et réessayez.');
    }
  }

  selectTournament(tournament: Tournament): void {
    this.tournamentService.selectTournament(tournament);
    if (tournament.isDraft) {
      this.participantsPerGroup.set(tournament.participantsPerGroup);
      this.groups.set(tournament.groups.length > 0 ? tournament.groups : [
        this.createGroup(0, tournament.participantsPerGroup),
        this.createGroup(1, tournament.participantsPerGroup)
      ]);
      this.currentView.set('edit');
    } else {
      this.currentView.set('bracket');
    }
  }

  async deleteTournament(tournamentId: string): Promise<void> {
    if (
      !confirm(
        'Voulez-vous vraiment supprimer ce tournoi ? Tous ses combats, paris, résultats et changements de statistiques des combattants seront également supprimés.',
      )
    ) {
      return;
    }

    try {
      await this.historyService.deleteTournamentMatches(tournamentId);
      this.tournamentService.deleteTournament(tournamentId);
      this.currentView.set('list');
    } catch (error) {
      console.error('Erreur lors de la suppression des résultats du tournoi', error);
      alert('La suppression du tournoi n’a pas pu être terminée. Vérifiez votre connexion et réessayez.');
    }
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

  tournamentMatchHistory(tournament: Tournament, match: TournamentMatch): HistoryEntry | null {
    const matches = this.historyService.allMatches();
    const exact = matches.find(
      (entry) => entry.tournamentId === tournament.id && entry.tournamentMatchId === match.id,
    );
    if (exact || !match.winner) return exact ?? null;

    const groupA = tournament.groups.find((group) => group.id === match.participant1);
    const groupB = tournament.groups.find((group) => group.id === match.participant2);
    if (!groupA || !groupB) return null;

    const winnerGroup = tournament.groups.find((group) => group.id === match.winner);
    if (!winnerGroup) return null;
    const groupIds = (ids: string[] | undefined, group: TournamentGroup): boolean =>
      !!ids && ids.length === group.participants.length && group.participants.every((id) => ids.includes(id));

    return (
      matches
        .filter((entry) => {
          if (entry.timestamp < tournament.createdAt) return false;
          const teamsMatch =
            (groupIds(entry.teamA_ids, groupA) && groupIds(entry.teamB_ids, groupB)) ||
            (groupIds(entry.teamA_ids, groupB) && groupIds(entry.teamB_ids, groupA));
          const recordedWinnerIds = entry.winner === 'A' ? entry.teamA_ids : entry.teamB_ids;
          return teamsMatch && groupIds(recordedWinnerIds, winnerGroup);
        })
        .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
    );
  }

  tournamentMatchTeamLabel(tournament: Tournament, match: TournamentMatch, side: 'A' | 'B'): string {
    const active = this.activeTournamentMatch();
    if (active && active.tournamentMatchId === match.id) {
      return (side === 'A' ? active.teamA : active.teamB).map((player) => player.name).join(' & ');
    }
    const history = this.tournamentMatchHistory(tournament, match);
    if (history) return side === 'A' ? history.teamA_names : history.teamB_names;
    return this.teamLabel(tournament, side === 'A' ? match.participant1 : match.participant2);
  }

  tournamentMatchOdds(tournament: Tournament, match: TournamentMatch, side: 'A' | 'B'): string | null {
    const active = this.activeTournamentMatch();
    if (active && active.tournamentMatchId === match.id) {
      return side === 'A' ? active.oddsA : active.oddsB;
    }
    const history = this.tournamentMatchHistory(tournament, match);
    if (history) return side === 'A' ? history.oddsA : history.oddsB;
    return this.matchOdds(tournament, match, side);
  }

  tournamentMatchWinnerLabel(tournament: Tournament, match: TournamentMatch): string {
    const history = this.tournamentMatchHistory(tournament, match);
    if (history) {
      return history.winner === 'A' ? history.teamA_names : history.teamB_names;
    }
    return this.teamLabel(tournament, match.winner);
  }

  openTournamentMatchDetails(tournament: Tournament, match: TournamentMatch): void {
    const history = this.tournamentMatchHistory(tournament, match);
    if (history) this.selectedMatchId.set(history.id);
  }

  closeMatchDetails(): void {
    this.selectedMatchId.set(null);
  }

  onMatchSelect(match: TournamentMatch): void {
    this.selectedTournamentMatch.set(match);
  }

  matchOdds(tournament: Tournament, match: TournamentMatch, side: 'A' | 'B'): string | null {
    const quote = this.tournamentMatchQuote(tournament, match);
    return quote ? (side === 'A' ? quote.oddsA : quote.oddsB) : null;
  }

  private tournamentMatchQuote(
    tournament: Tournament,
    match: TournamentMatch,
  ): { probA: number; probB: number; oddsA: string; oddsB: string } | null {
    const groupA = tournament.groups.find((candidate) => candidate.id === match.participant1);
    const groupB = tournament.groups.find((candidate) => candidate.id === match.participant2);
    if (!groupA || !groupB) return null;

    const teamA = groupA.participants.map((id) => this.players().find((player) => player.id === id));
    const resolvedTeamA = teamA.filter((player): player is Player => !!player);
    if (resolvedTeamA.length !== groupA.participants.length || resolvedTeamA.length === 0) return null;

    const teamB = groupB.participants.map((id) => this.players().find((player) => player.id === id));
    const resolvedTeamB = teamB.filter((player): player is Player => !!player);
    if (resolvedTeamB.length !== groupB.participants.length || resolvedTeamB.length === 0) return null;

    const eloA = averageElo(resolvedTeamA.map((player) => player.elo));
    const eloB = averageElo(resolvedTeamB.map((player) => player.elo));
    const probA = expectedScoreA(eloA, eloB);
    const probB = 1 - probA;
    const baseOdds = this.settingsService.settings().baseOdds;
    return {
      probA,
      probB,
      oddsA: computeOdds(probA, baseOdds),
      oddsB: computeOdds(probB, baseOdds),
    };
  }

  async startTournamentMatch(match: TournamentMatch): Promise<void> {
    const tournament = this.currentTournament();
    if (!this.isAdmin() || !tournament) return;
    if (!match.participant1 || !match.participant2) {
      alert('Les deux équipes doivent être définies pour lancer ce combat.');
      return;
    }
    const activeMatch = this.activeMatch();
    if (activeMatch === undefined) {
      alert('Le match en cours est encore en chargement. Réessayez dans un instant.');
      return;
    }
    if (activeMatch) {
      alert(
        activeMatch.tournamentId === tournament.id && activeMatch.tournamentMatchId === match.id
          ? 'Ce combat est déjà en cours.'
          : 'Un autre match est déjà en cours. Terminez-le ou annulez-le avant de démarrer ce combat.',
      );
      return;
    }

    const teamA = this.getTeamPlayers(tournament, match.participant1);
    const teamB = this.getTeamPlayers(tournament, match.participant2);
    if (!teamA || !teamB) {
      alert('Impossible de retrouver tous les combattants de ces équipes dans la base de données.');
      return;
    }
    const quote = this.tournamentMatchQuote(tournament, match);
    if (!quote) {
      alert('Impossible de calculer les cotes de base de ce combat.');
      return;
    }

    try {
      await this.matchService.createMatch(teamA, teamB, this.settingsService.settings(), {
        tournamentId: tournament.id,
        matchId: match.id,
        participantA: match.participant1,
        participantB: match.participant2,
        ...quote,
      });
    } catch (error) {
      console.error('Erreur lors du démarrage du combat du tournoi', error);
      alert('Impossible de démarrer ce combat. Vérifiez votre connexion et réessayez.');
    }
  }

  placeTournamentBet(payload: { team: TeamSide; user: string; amount: number }): void {
    const match = this.activeTournamentMatch();
    if (!match) return;
    this.matchService
      .placeBet(match, payload.team, payload.user, payload.amount)
      .catch((error) => {
        console.error('Erreur lors de l’ajout du pari du tournoi', error);
        alert('Impossible d’ajouter ce pari. Vérifiez votre connexion et réessayez.');
      });
  }

  cancelTournamentBet(betId: string): void {
    this.matchService.cancelActiveBet(betId).catch((error) => {
      console.error('Erreur lors de l’annulation du pari du tournoi', error);
      alert('Impossible d’annuler ce pari. Vérifiez votre connexion et réessayez.');
    });
  }

  resolveTournamentMatch(winner: TeamSide): void {
    const match = this.activeTournamentMatch();
    if (!match) return;
    this.matchService
      .resolveMatch(match, winner, this.settingsService.settings())
      .catch((error) => {
        console.error('Erreur lors de la résolution du combat du tournoi', error);
        alert('Impossible d’enregistrer le résultat du combat. Vérifiez votre connexion et réessayez.');
      });
  }

  cancelTournamentMatch(): void {
    this.matchService.cancelMatch().catch((error) => {
      console.error('Erreur lors de l’annulation du combat du tournoi', error);
      alert('Impossible d’annuler ce combat. Vérifiez votre connexion et réessayez.');
    });
  }

  toggleTournamentBetPaid(payload: { betId: string; currentStatus: boolean }): void {
    const matchId = this.selectedMatchId();
    if (!matchId) return;
    this.historyService.togglebetPaid(matchId, payload.betId, payload.currentStatus).catch((error) => {
      console.error('Erreur lors de la mise à jour du paiement du pari du tournoi', error);
      alert('Impossible de mettre à jour le paiement. Vérifiez votre connexion et réessayez.');
    });
  }

  private getTeamPlayers(tournament: Tournament, groupId: string): Player[] | null {
    const group = tournament.groups.find((candidate) => candidate.id === groupId);
    if (!group) return null;
    const players = group.participants.map((id) => this.players().find((player) => player.id === id));
    if (players.some((player) => !player)) return null;
    return players.filter((player): player is Player => !!player);
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

import { Component, inject, signal } from '@angular/core';
import { TournamentService } from './tournament.service';
import { Tournament, TournamentGroup } from './tournament.model';
import { FormsModule } from '@angular/forms';
import { TournamentBracketComponent } from './tournament-bracket/tournament-bracket.component';

@Component({
  selector: 'app-tournois-page',
  standalone: true,
  imports: [FormsModule, TournamentBracketComponent],
  templateUrl: './tournois-page.component.html',
})
export class TournoisPageComponent {
  private readonly tournamentService = inject(TournamentService);

  readonly tournaments = this.tournamentService.tournaments;
  readonly currentTournament = this.tournamentService.currentTournament;

  // Formulaire de création
  readonly showCreateForm = signal(false);
  readonly tournamentName = signal('');
  readonly participantsPerGroup = signal(2);

  // Formulaire des participants
  readonly showParticipantsForm = signal(false);
  readonly groups = signal<TournamentGroup[]>([]);

  // Vue
  readonly currentView = signal<'list' | 'create' | 'participants' | 'bracket'>('list');

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

    const numParticipants = this.participantsPerGroup();

    // Créer 2 groupes par défaut
    const newGroups: TournamentGroup[] = [
      {
        id: `group-0`,
        name: '',
        participants: Array(numParticipants).fill(''),
      },
      {
        id: `group-1`,
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
      id: `group-${currentGroups.length}`,
      name: '',
      participants: Array(numParticipants).fill(''),
    };
    this.groups.set([...currentGroups, newGroup]);
  }

  removeGroup(index: number): void {
    const currentGroups = this.groups();
    if (currentGroups.length <= 2) {
      alert('Il faut au minimum 2 groupes pour créer un tournoi');
      return;
    }
    this.groups.set(currentGroups.filter((_, i) => i !== index));
  }

  updateParticipantName(groupIndex: number, participantIndex: number, value: string): void {
    const currentGroups = this.groups();
    currentGroups[groupIndex].participants[participantIndex] = value;
    this.groups.set([...currentGroups]);
  }

  updateGroupName(groupIndex: number, value: string): void {
    const currentGroups = this.groups();
    currentGroups[groupIndex].name = value;
    this.groups.set([...currentGroups]);
  }

  createTournament(): void {
    const name = this.tournamentName().trim();
    if (!name) {
      alert('Veuillez entrer un nom pour le tournoi');
      return;
    }

    const groups = this.groups();
    const allParticipants = groups.flatMap((g) => g.participants.filter((p) => p.trim()));

    if (allParticipants.length < 2) {
      alert('Il faut au moins 2 participants pour créer un tournoi');
      return;
    }

    this.tournamentService.createTournament(name, groups);
    this.currentView.set('list');
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
}

import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { BeersService } from '../services/beers.service';
import { Beer } from '../models/beer.model';
import { FileUploadService } from '../services/file-upload-service.service';
import { AlertService } from '../services/alert.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-admin-beers',
  templateUrl: './admin-beers.component.html',
  styleUrls: ['./admin-beers.component.scss']
})
export class AdminBeersComponent implements OnInit, OnDestroy {
  public allBeers: any[] = [];
  selectedFile: File | null = null;
  useStorage = environment.useStorage;
  isLoading = true;
  isSaving = false;

  beerName = '';
  beerDescription = '';
  imageUrl = '';

  private beersSub?: Subscription;

  constructor(
    private beersService: BeersService,
    private _toast: AlertService,
    @Inject(AngularFireStorage) private storage: AngularFireStorage,
    @Inject(FileUploadService) private fileService: FileUploadService
  ) {}

  ngOnInit(): void {
    this.fetchBeerSelection();
  }

  ngOnDestroy(): void {
    this.beersSub?.unsubscribe();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  fetchBeerSelection(): void {
    this.beersSub = this.beersService.getBeers().subscribe({
      next: (beers: Beer[]) => {
        this.allBeers = beers || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching beer selection:', error);
        this.isLoading = false;
      }
    });
  }

  uploadBeer(): void {
    if (!this.beerName.trim() || !this.beerDescription.trim()) {
      this._toast.showWarning('CHAMPS REQUIS', 'Veuillez renseigner le nom et la description de la bière');
      return;
    }

    if (!environment.useStorage) {
      this.imageUrl = this.imageUrl.trim() || 'assets/BIERES.jpg';
      this.addBeer();
      return;
    }

    if (!this.selectedFile) {
      this._toast.showWarning('IMAGE REQUISE', 'Veuillez sélectionner une image');
      return;
    }

    if (this.isFileImage(this.selectedFile)) {
      this.uploadImage(this.selectedFile);
    } else {
      this._toast.showWarning('FORMAT INVALIDE', "Le fichier choisi n'est pas une image");
    }
  }

  confirmAndRemoveBeer(beerId: string): void {
    const confirmation = window.confirm('Supprimer cette bière de la carte ?');
    if (confirmation) {
      this.removeBeer(beerId);
    }
  }

  removeBeer(beerId: string): void {
    this.beersService
      .removeBeer(beerId)
      .then(() => {
        this._toast.showSucces('SUPPRESSION', 'Bière retirée de la carte');
      })
      .catch((error) => {
        console.error('Erreur lors de la suppression de la bière :', error);
        this._toast.showError('ERREUR', 'Impossible de supprimer cette bière');
      });
  }

  isFileImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  uploadImage(file: File): void {
    this.isSaving = true;
    const filePath = 'images/' + file.name;
    const fileRef = this.storage.ref(filePath);
    const task = this.storage.upload(filePath, file);

    task.snapshotChanges().subscribe({
      complete: () => {
        fileRef.getDownloadURL().subscribe({
          next: (url) => {
            this.imageUrl = url;
            this.addBeer();
          },
          error: (error) => {
            console.error(error);
            this.isSaving = false;
            this._toast.showError('ERREUR', "Impossible de récupérer l'image");
          }
        });
      },
      error: (error) => {
        console.error('Erreur lors du téléchargement du fichier :', error);
        this.isSaving = false;
        this._toast.showError('ERREUR', "Échec de l'envoi de l'image");
      }
    });
  }

  async addBeer(): Promise<void> {
    const newBeer: Beer = {
      name: this.beerName.trim(),
      description: this.beerDescription.trim(),
      imageUrl: this.imageUrl
    };

    this.isSaving = true;
    try {
      await this.beersService.addBeer(newBeer);
      this.beerName = '';
      this.beerDescription = '';
      this.imageUrl = '';
      this.selectedFile = null;
      this._toast.showSucces('CARTE DES BIÈRES', 'Bière ajoutée à la carte');
    } catch (error) {
      console.error('Erreur ajout bière :', error);
      this._toast.showError('ERREUR', "Impossible d'ajouter cette bière");
    } finally {
      this.isSaving = false;
    }
  }
}

import { Component, OnInit,Inject, } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { BeersService } from '../services/beers.service';
import { Beer } from '../models/beer.model'; 
import { FileUploadService } from '../services/file-upload-service.service';

import { environment } from 'src/environments/environment';
@Component({
  selector: 'app-admin-beers',
  templateUrl: './admin-beers.component.html',
  styleUrls: ['./admin-beers.component.scss']
})
export class AdminBeersComponent implements OnInit {
  public allBeers: any // Utilisez le type Beer pour typer allBeers
  selectedFile: File | null = null; // Initialiser avec null
  // Sans Firebase Storage, la bière est ajoutée avec une URL d'image saisie (ou l'image par défaut)
  useStorage = environment.useStorage;
  constructor(
    private beersService: BeersService,    
    @Inject(AngularFireStorage) private storage: AngularFireStorage, 
    @Inject(FileUploadService) private fileService: FileUploadService,
    ) {
    
  }

  async ngOnInit(){
    this.fetchBeerSelection();
  }
    // Fonction pour gérer la sélection de fichier
    onFileSelected(event: Event): void {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
        this.selectedFile = input.files[0];
        console.log('Fichier sélectionné :', this.selectedFile.name);
      }
    }

    fetchBeerSelection(): void {
      this.beersService.getBeers().subscribe(
        (beers: Beer[]) => {
          this.allBeers = beers;
          console.log(this.allBeers);
          
        },
        error => {
          console.error('Error fetching beer selection:', error);
        }
      );
    }
  // Déclarez les propriétés pour stocker le nom de la bière, la description et l'URL de l'image
beerName: string = '';
beerDescription: string = '';
imageUrl: string = '';

/*
onFileDrop(files: NgxFileDropEntry[]): void {
  for (const droppedFile of files) {
    if (droppedFile.fileEntry.isFile) {
      const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
      fileEntry.file((file: File) => {
        // Vérifiez si le fichier est une image
        if (this.isFileImage(file)) {
          console.log('Fichier sélectionné :', file.name);
          const filePath = 'images/' + file.name;
          const fileRef = this.storage.ref(filePath);
          const task = this.storage.upload(filePath, file);
          task.snapshotChanges().subscribe({
            next: snapshot => {
              console.log('Téléchargement réussi !');
              // Obtenez l'URL de téléchargement après le succès du téléchargement
              fileRef.getDownloadURL().subscribe(url => {
                console.log('URL de téléchargement:', url);
                // Mettez à jour l'avatar avec l'URL téléchargée
                this.imageUrl = url;
                this.addBeer();
              });
            },
            error: error => {
              console.error('Erreur lors du téléchargement du fichier :', error);
              // Gérez l'erreur ici (par exemple, affichez un message d'erreur à l'utilisateur)
            }
          });
          
          // Téléchargez le fichier vers Firebase Storage comme avant...
          // Mettez à jour l'URL de l'image
          
        } else {
          console.log('Fichier sélectionné n\'est pas une image.');
          // Gérez le cas où un fichier non-image est sélectionné (facultatif)
        }
      });
    }
  }
}*/

// Fonction pour télécharger la bière avec ses détails
/*addBeer() {
  // Vérifiez si les champs de la bière sont renseignés
  if (this.beerName && this.beerDescription && this.imageUrl) {
    // Créez un objet de type Beer avec les détails de la bière
    const newBeer: Beer = {
      name: this.beerName,
      description: this.beerDescription,
      imageUrl: this.imageUrl
    };

    // Appelez simplement la méthode addBeer du service beersService
    this.beersService.addBeer(newBeer);

    // Mettez également à jour la liste des bières dans le composant
    this.allBeers.push(newBeer);

    // Gérez la suite du traitement ici, par exemple, afficher un message de succès
    console.log('Bière ajoutée avec succès !');

  } else {
    // Gérez le cas où tous les champs ne sont pas renseignés
    console.log('Veuillez remplir tous les champs.');
  }
}*/


// Fonction pour télécharger la bière avec les détails renseignés
uploadBeer(): void {
  if (!environment.useStorage) {
    this.imageUrl = this.imageUrl.trim() || 'assets/BIERES.jpg';
    this.addBeer();
    return;
  }
  if (!this.selectedFile) {
    console.log('Veuillez sélectionner un fichier.');
    return;
  }
  // Vérifiez si le fichier est une image
  if (this.isFileImage(this.selectedFile)) {
    console.log('Fichier sélectionné :', this.selectedFile.name);
    // Téléchargez l'image vers Firebase Storage
    this.uploadImage(this.selectedFile);
  } else {
    console.log('Fichier sélectionné n\'est pas une image.');
    // Gérez le cas où un fichier non-image est sélectionné (facultatif)
  }
}
confirmAndRemoveBeer(beerId: string): void {
  const confirmation = confirm('Êtes-vous sûr de vouloir supprimer cette bière ?');
  if (confirmation) {
    this.removeBeer(beerId);
  }
}
removeBeer(beerId: string): void {
  this.beersService.removeBeer(beerId).then(() => {
    console.log('Bière supprimée avec succès !');
    this.allBeers = this.allBeers.filter((beer: Beer) => beer.id !== beerId);
  }).catch(error => {
    console.error('Erreur lors de la suppression de la bière :', error);
  });
}
// Fonction pour vérifier si le fichier est une image
isFileImage(file: File): boolean {
  return file.type.startsWith('image/');
}
uploadImage(file: File): void {
  const filePath = 'images/' + file.name;
  const fileRef = this.storage.ref(filePath);
  const task = this.storage.upload(filePath, file);

  task.snapshotChanges().subscribe({
    next: snapshot => {
      console.log('Téléchargement réussi !');
      // Obtenez l'URL de téléchargement après le succès du téléchargement
      fileRef.getDownloadURL().subscribe(url => {
        console.log('URL de téléchargement:', url);
        // Mettez à jour l'URL de l'image
        this.imageUrl = url;
        // Ajoutez la bière à la base de données après avoir téléchargé l'image
        this.addBeer();
      });
    },
    error: error => {
      console.error('Erreur lors du téléchargement du fichier :', error);
      // Gérez l'erreur ici (par exemple, affichez un message d'erreur à l'utilisateur)
    }
  });
}
// Fonction pour ajouter la bière à la base de données avec les détails renseignés
addBeer() {
  // Vérifiez si les champs de la bière sont renseignés
  if (this.beerName && this.beerDescription && this.imageUrl) {
    // Créez un objet de type Beer avec les détails de la bière
    const newBeer: Beer = {
      name: this.beerName,
      description: this.beerDescription,
      imageUrl: this.imageUrl
    };

    // Appelez simplement la méthode addBeer du service beersService
    this.beersService.addBeer(newBeer);

    // Mettez également à jour la liste des bières dans le composant
    this.allBeers.push(newBeer);

    // Gérez la suite du traitement ici, par exemple, afficher un message de succès
    console.log('Bière ajoutée avec succès !');

  } else {
    // Gérez le cas où tous les champs ne sont pas renseignés
    console.log('Veuillez remplir tous les champs.');
  }
}


  
  
}


import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import {Observable, of } from 'rxjs';
import { finalize } from "rxjs/operators";
import { AlertService } from '../services/alert.service';
import { AuthenticationService } from '../services/authentication.service';
import { FileUploadService } from '../services/file-upload-service.service';
import { NgxFileDropEntry } from 'ngx-file-drop';
@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent{
  @Output() close: EventEmitter<void> = new EventEmitter<void>();
  // Autres méthodes et propriétés du composant
  selectedImage: any = null;
  downloadURL!: Observable<string>;
  url!:string;
  avatar!:Observable<string>;
  id!:string;
  file!:string;
  private uid!:string
  files!: NgxFileDropEntry[];
  constructor( 
    @Inject(AngularFireStorage) private storage: AngularFireStorage, 
    @Inject(FileUploadService) private fileService: FileUploadService,
    private authService: AuthenticationService,
    private db: AngularFirestore,
    private _toast:AlertService,
    ) { }
  ngOnInit() {
    this.uid = this.authService.getUserInfos().uid
    this.avatar = of(this.authService.getUserInfos().avatar)
  }
  onClose() {
    this.close.emit();
  }
  onFileDrop(files: NgxFileDropEntry[]): void {
    for (const droppedFile of files) {
      if (droppedFile.fileEntry.isFile) {
        const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
        fileEntry.file((file: File) => {
          // Vérifiez si le fichier est une image
          if (this.isFileImage(file)) {

            // Téléchargez le fichier vers Firebase Storage
            // Chaque utilisateur écrit uniquement dans son propre dossier (voir storage.rules)
            const filePath = `avatars/${this.uid}/${file.name}`;
            const fileRef = this.storage.ref(filePath);
            const task = this.storage.upload(filePath, file);

            // Gérez le succès ou l'erreur du téléchargement
            task.snapshotChanges().subscribe({
              next: snapshot => {
                // Obtenez l'URL de téléchargement après le succès du téléchargement
                fileRef.getDownloadURL().subscribe(url => {
                  // Mettez à jour l'avatar avec l'URL téléchargée
                  this.updateAvatar(url);
                });
              },
              error: error => {
                console.error('Erreur lors du téléchargement du fichier :', error);
                // Gérez l'erreur ici (par exemple, affichez un message d'erreur à l'utilisateur)
              }
            });
          } else {
            // Gérez le cas où un fichier non-image est sélectionné (facultatif)
          }
        });
      }
    }
  }
  isFileImage(file: File): boolean {
    
    return file.type.startsWith('image/');
  }

 updateAvatar(url: string): void {
    // Remplacez ceci par la méthode pour obtenir l'ID de l'utilisateur
    // Mettre à jour l'avatar pour l'utilisateur actuel dans Firestore
    this.db.collection('users').doc(this.uid).update({ avatar: url })
      .then(() => {
        // Mettre à jour l'avatar pour tous les rendez-vous de l'utilisateur actuel
        this.db.collection('rendez_vous', ref => ref.where('user_id', '==', this.uid)).get().toPromise().then((snapshot: any) => {
          snapshot.forEach((doc: any) => {
            doc.ref.update({ avatar: url });
          });
        });
        // Afficher un message de succès
        this._toast.showSucces('Avatar mis à jour', 'Votre image de profil a été modifiée avec succès');
      })
      .catch(error => {
        console.error('Erreur lors de la mise à jour de l\'avatar :', error);
        // Afficher un message d'erreur
        this._toast.showError('Erreur', 'Une erreur est survenue lors de la mise à jour de votre avatar');
      });
  }

  onFileOver(event: any): void {
      // Logique à exécuter lorsque le curseur survole la zone de dépôt de fichiers
  }

  onFileLeave(event: any): void {
      // Logique à exécuter lorsque le curseur quitte la zone de dépôt de fichiers
  }
  /*save(event:any){
    const file = event.target.files[0];
    const filePath = 'images/' + file.name;
    const fileRef = this.storage.ref(filePath);
    const task = this.storage.upload(filePath, file);
    task.snapshotChanges().pipe(
      finalize(() => {
        this.avatar = fileRef.getDownloadURL();
        this.avatar.subscribe(url => {
          // Mettre à jour le champ "avatar" pour l'utilisateur actuel
          this.db.collection('users').doc(this.uid).update({
            avatar: url
          });          
          // Mettre à jour le champ "avatar" pour tous les rendez-vous de l'utilisateur actuel
          this.db.collection('rendez_vous', ref => ref.where('user_id', '==', this.uid)).get().toPromise().then((snapshot:any) => {
            snapshot.forEach((doc:any) => {
              doc.ref.update({ avatar: url });
            });
          });          
          this._toast.showSucces('AVATAR','votre image de profile à bien été modifié');
          this.authService.editDataInLocalStorage('userInfos','avatar',url);
          this._toast.showSucces('votre avatar à été modifié','avatar')
        })
      })
    ).subscribe();
  }*/
}
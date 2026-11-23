import { Injectable } from '@angular/core';
import { cafeCiseau } from '../models/cafe-ciseaux.model';
import { contactDetails } from '../models/contact-details.model';
import { Bar } from '../models/bar.model';
@Injectable({
  providedIn: 'root'
})
export class cafeCiseauxService {
    cafeCiseaux: cafeCiseau[] = [
        {
            id: 1,
            title: 'Le salon',
            description: 'BIENVENUE CHEZ CAFÉ CISEAUX.',
            text: 'Fitim vous accueille dans son salon situé au centre de Malmedy. Dans une ambiance décontractée et chaleureuse, vous pourrez vous arrêter pour y déguster une sélection de bières spéciales ou simplement partager un café.',
            imageUrl: 'assets/STORE.jpg',
          }
    ]
    barDetails: cafeCiseau[] = [
        {
          id:2,
          title: 'Le bar',
          description: 'UN MOMENT DE CONVIVIALITÉ.',
          text: 'Afin de vous faire patienter, nous vous invitons à vous détendre dans notre espace bar. Vous aurez l’occasion d’y découvrir une minutieuse sélection de bières spéciales.',
          imageUrl: 'assets/SALON.jpg',
        }
  ]
    contactDetails:contactDetails [] = [
      {
        name:"Balija",
        surname: "Fitim",
        phone_n: " 0497 99 12 26",
        street : "Rle Grognet 8,",
        country: "Belgium",
        city: "Malmedy",
        zip_code: "4960"
      }
    ]
    bar:Bar[] = [
      {
        id:1,  
        title: 'cristal',
        description: 'La Cristal est l’association de malts très légèrement touraillés avec un houblon noble, le Saaz, connu pour son arôme doux et légèrement épicé. Bière blonde légère désaltérante.',
        imageUrl: 'assets/beer/CRISTAL.png',
      },      
      {
        id:2,  
        title: 'hazy pale',
        description: 'Houblonnée avec le plus célèbre et classique des duos de houblons « Citra et Mosaic » pour apporter de la mangue, des agrumes, de la papaye et du fruit de la passion. Avoine et blé sont de la partie pour créer un corps crémeux qui reste facile à boire.',
        imageUrl: 'assets/beer/HAZY_PALE.jpg',
      },      
      {
        id:3,  
        title: 'legia fruitée',
        description: 'Une bière de base ultra légère, mais structurée. Elle est mariée au cassis, qui lui apporte de jolis reflets violacés à la robe et des notes fruitées délicates en première bouche',
        imageUrl: 'assets/beer/LEGIA_FRUITEE.png',
      },      
      {
        id:4,  
        title: 'legia triple',
        description: 'Dans l’esprit d’une bière Triple, riche et ample, chaleureuse avec ses 8% d’alcool mais sèche (pas d’impression sucrée en finale), sans adjuvant (ni épice, ni artifice)',
        imageUrl: 'assets/beer/LEGIA_TRIPLE.png',
      },      
      {
        id:5,  
        title: 'peak blonde',
        description: 'Bière d\'altitude, la Peak Blonde est notre valeur sûre. Rafraîchissante et très digeste grâce à son subtil houblonnage à cru, elle présente des notes agrumées - mandarine - et florales',
        imageUrl: 'assets/beer/PEAK_BLONDE.jpg',
      },      
      {
        id:6,  
        title: 'peak triple',
        description: 'Bière robuste d\'altitude, la Peak Triple s\'ouvre aux amateurs de bières intenses. La sélection de houblons et son Dry Hopping vous emmènent vers des pentes aux arômes de pêches blanches et fruits ',
        imageUrl: 'assets/beer/PEAK_TRIPLE.jpg',
      }
    ]
    getAllBlocs(): cafeCiseau[] {
        return this.cafeCiseaux;
    }
    getAllBeer(): Bar[] {
      return this.bar;
    }
    getContactDetails(): contactDetails[] {
      return this.contactDetails;
    }
    getBarDetails(): cafeCiseau[] {
      return this.barDetails;
    }
    getBlockById(cafeCiseauId: number): cafeCiseau{
        const blockUnit =  this.cafeCiseaux.find(cafeCiseau => cafeCiseau.id === cafeCiseauId)
        if(!blockUnit){
            throw new Error('block not found')
        }else{
          return blockUnit
        }
    }
}
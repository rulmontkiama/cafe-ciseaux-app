export interface Users {
  uid: string;
  email: string;
  nom: string;
  prenom: string;
  birthdate: string;
  phone?: string;
  scissor: number;
  avatar: string;
  fcmTokens?: string[];
}

export interface UsersWithRdvCount extends Users {
  rdvCount: number;
}

// Interface étendue qui inclut rdvCount et documentSnapshot
export interface UsersWithRdvSnap extends Users {
  rdvCount: number;
  documentSnapshot: import('@angular/fire/compat/firestore').QueryDocumentSnapshot<UsersWithRdvSnap>;
}

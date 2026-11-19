// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
interface Environment {
  production: boolean;
  imagePath: any;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    firebaseStorageDownloadTokens:string;
    appId: string;
    measurementId: string;
  };
  // Compte de démonstration (optionnel). Laisser vide pour désactiver le "DEMO LOGIN".
  demo: {
    email: string;
    password: string;
  };

}


export const environment: Environment = {
  production: false,
  imagePath: '/assets',
  // TODO: CONFIG TEMPORAIRE (factice) uniquement pour afficher l'interface en local.
  // À remplacer par la vraie config de ton projet Firebase (voir FIREBASE_SETUP.md).
  firebase: {
    apiKey: "demo-api-key",
    authDomain: "demo-cafe-ciseaux.firebaseapp.com",
    projectId: "demo-cafe-ciseaux",
    storageBucket: "demo-cafe-ciseaux.appspot.com",
    messagingSenderId: "000000000000",
    firebaseStorageDownloadTokens: "",
    appId: "1:000000000000:web:0000000000000000",
    measurementId: ""
  },
  demo: {
    email: "",
    password: ""
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.

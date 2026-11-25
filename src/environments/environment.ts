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
  // Firebase Storage (photos de profil et images de bières) : false tant que Storage n'est pas activé
  useStorage: boolean;
  // URL du Cloudflare Worker gratuit qui relaie les notifications push de messages (FCM HTTP v1)
  pushWorkerUrl: string;
  // Compte de démonstration (optionnel). Laisser vide pour désactiver le "DEMO LOGIN".
  demo: {
    email: string;
    password: string;
  };

}


export const environment: Environment = {
  production: false,
  imagePath: '/assets',
  firebase: {
    apiKey: "AIzaSyAtfPGP0-rGS-Eh1J1QLMaQTQuVjBXpYEA",
    authDomain: "cafe-ciseaux-e342d.firebaseapp.com",
    projectId: "cafe-ciseaux-e342d",
    storageBucket: "cafe-ciseaux-e342d.firebasestorage.app",
    messagingSenderId: "406207272951",
    firebaseStorageDownloadTokens: "",
    appId: "1:406207272951:web:b939c4a1759cf85b3900f2",
    measurementId: "G-MKWR92181W"
  },
  useStorage: false,
  pushWorkerUrl: "https://cafe-ciseaux-push.cafe-ciseaux.workers.dev/notify-message",
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

import fs from 'node:fs';
import path from 'node:path';

/**
 * @capacitor-firebase/authentication@5.4.1 fige GoogleSignIn à 7.0.0 dans son podspec,
 * qui ne contient pas le PrivacyInfo.xcprivacy requis par Apple (erreur ITMS-91061 / Binaire non valide).
 * GoogleSignIn 7.1.0+ est 100 % compatible en API et embarque les manifestes de confidentialité
 * pour GoogleSignIn, GTMAppAuth, GTMSessionFetcher et AppAuth.
 */
const podspecPath = path.join(
  process.cwd(),
  'node_modules',
  '@capacitor-firebase',
  'authentication',
  'CapacitorFirebaseAuthentication.podspec'
);

if (fs.existsSync(podspecPath)) {
  const before = fs.readFileSync(podspecPath, 'utf8');
  const after = before.replace(
    /google\.dependency\s+'GoogleSignIn',\s*'7\.0\.0'/,
    "google.dependency 'GoogleSignIn', '~> 7.1.0'"
  );
  if (after !== before) {
    fs.writeFileSync(podspecPath, after, 'utf8');
    console.log('[patch-ios-pods] Patched GoogleSignIn 7.0.0 -> ~> 7.1.0 for Apple Privacy Manifest compliance.');
  } else {
    console.log('[patch-ios-pods] GoogleSignIn dependency already patched.');
  }
} else {
  console.log('[patch-ios-pods] Podspec not found yet (skipping).');
}

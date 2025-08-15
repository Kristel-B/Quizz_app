
# Quiz Jeu TV — Pro Max (Expo)

- **Grosse banque de questions** intégrée : 50 questions par niveau enfant (CP→CM2 + Collège) et 120 pour **Adulte (culture générale)**.
- **Ajout/édition** dans l’app (import CSV/JSON via presse‑papiers, export JSON).
- **Modes** : Classique, VF, QCM, Mix. Chrono on/off.
- **Tout fonctionne hors‑ligne** après installation.

## Compilation APK depuis téléphone (Expo Cloud)
1. Installe **Termux** puis :
   ```bash
   pkg install nodejs
   npm i -g eas-cli
   eas login
   ```
2. Décompresse ce projet dans un dossier et lance :
   ```bash
   npm install
   eas build -p android --profile preview
   ```
3. Récupère le **lien de l’APK** fourni par EAS et installe.

> Tu peux modifier/ajouter des questions directement dans l’app (pas besoin d’ordi). Pense à **Exporter JSON** pour sauvegarder avant de changer de téléphone.

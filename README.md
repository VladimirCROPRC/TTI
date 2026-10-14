# TTI · Harta rețelei

## Editare comună

În fereastra fiecărui punct poți salva observații, muta punctul pe alt strat, încărca fotografii JPEG/PNG/WebP (maximum 10 MB fiecare) și șterge punctul. Punctele șterse se restaurează din butonul „Puncte șterse”. Fotografiile originale rămân în repository; fotografiile noi sunt în Cloudflare R2. Observațiile, stratul și ștergerile se salvează în Cloudflare D1 prin Worker-ul `tti-api`.

Nu există autentificare, conform cerinței: orice vizitator poate modifica datele comune. Ștergerea punctelor este reversibilă. Modificările simultane sunt respinse dacă versiunea punctului s-a schimbat; în acest caz încarcă ultima versiune înainte de salvare. Harta se sincronizează la 30 secunde când fereastra de editare este închisă și la revenirea în pagină. Textul introdus nu este executat ca HTML.

Endpoint-ul public este declarat în `dist/config.js`; nu sunt incluse chei API. D1 este `tti-db`, iar R2 `tti-photos`. Codul backend-ului este în `backend/`. Pentru modificări ale API-ului rulează `npx wrangler@4 deploy` din acest director cu sesiunea Cloudflare autorizată. Nu rula seed-ul la un reimport care schimbă identificatorii fără o migrare: ID-urile inițiale din KMZ trebuie păstrate pentru a menține observațiile și fotografiile asociate.

Testele de integrare rulează exclusiv împotriva API-ului local: inițializează schema și seed-ul cu `wrangler d1 execute ... --local`, pornește `wrangler dev --port 8787`, apoi rulează `node backend/test-api.mjs`. Baza locală este separată de cea de producție.

Aplicație statică în română: OpenStreetMap / Esri World Imagery, un strat comun pentru cabluri și straturi independente pentru fiecare categorie de puncte din KMZ. Simbolurile PNG, culorile și grosimile traseelor sunt importate din KML. Click pe punct deschide fotografiile; click pe fotografie deschide galeria cu navigare prin săgeți și tastatură.

Date inițiale: 37 puncte, 42 trasee, 148 fotografii, 6 categorii. Fișierele foto sunt păstrate local în `dist/files/`, fără servicii externe pentru fotografii. Conținutul descrierilor este tratat ca text, nu ca HTML executabil.

## Pornire

Deschide direct `dist/index.html` în browser. Datele sunt incluse în `data.js`, astfel încât funcționează și prin `file://`, fără server local. Alternativ, instalează Node.js și rulează `npm start` în directorul proiectului, apoi deschide http://127.0.0.1:4173. Nu există dependențe npm. Leaflet 1.9.4 este inclus local. Hărțile de bază necesită internet.

## Reimport

Cu Python 3: `python scripts/import_kmz.py /cale/TTI.kmz`. Importatorul extrage imaginile, rezolvă StyleMap normal, convertește culorile KML AABBGGRR și verifică toate referințele foto. Datele originale nu sunt modificate.

## Hosting

Publică directorul `dist` pe orice hosting static, inclusiv într-un subdirector. Nu sunt necesare chei API sau backend. Fotografiile devin accesibile persoanelor cu acces la site/repository. GitHub Pages nu este activat automat. Atribuirea furnizorilor este afișată pe hartă; pentru utilizare intensă configurează un furnizor de tile-uri adecvat politicilor OpenStreetMap: https://operations.osmfoundation.org/policies/tiles/.

Designul actual folosește o interfață cartografică cu antet bleumarin și accente verzi. Site-ul de referință oroc.proconect.ro nu a putut fi accesat la implementare; potrivirea vizuală exactă rămâne de verificat.

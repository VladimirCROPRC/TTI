# TTI · Harta rețelei

Aplicație statică în română: OpenStreetMap / Esri World Imagery, un strat comun pentru cabluri și straturi independente pentru fiecare categorie de puncte din KMZ. Simbolurile PNG, culorile și grosimile traseelor sunt importate din KML. Click pe punct deschide fotografiile; click pe fotografie deschide galeria cu navigare prin săgeți și tastatură.

Date inițiale: 37 puncte, 42 trasee, 148 fotografii, 6 categorii. Fișierele foto sunt păstrate local în `dist/files/`, fără servicii externe pentru fotografii. Conținutul descrierilor este tratat ca text, nu ca HTML executabil.

## Pornire

Instalează Node.js, apoi rulează `npm start` în directorul proiectului. Deschide http://127.0.0.1:4173. Nu există dependențe npm. Leaflet 1.9.4 este inclus local. Hărțile de bază necesită internet.

## Reimport

Cu Python 3: `python scripts/import_kmz.py /cale/TTI.kmz`. Importatorul extrage imaginile, rezolvă StyleMap normal, convertește culorile KML AABBGGRR și verifică toate referințele foto. Datele originale nu sunt modificate.

## Hosting

Publică directorul `dist` pe orice hosting static, inclusiv într-un subdirector. Nu sunt necesare chei API sau backend. Fotografiile devin accesibile persoanelor cu acces la site/repository. GitHub Pages nu este activat automat. Atribuirea furnizorilor este afișată pe hartă; pentru utilizare intensă configurează un furnizor de tile-uri adecvat politicilor OpenStreetMap: https://operations.osmfoundation.org/policies/tiles/.

Designul actual folosește o interfață cartografică cu antet bleumarin și accente verzi. Site-ul de referință oroc.proconect.ro nu a putut fi accesat la implementare; potrivirea vizuală exactă rămâne de verificat.

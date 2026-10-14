# TTI · Harta rețelei

Adresa aplicației: https://prevent.proconect.online/. Site-ul și API-ul sunt găzduite în Cloudflare Worker `tti-api`. Fiecare cerere, inclusiv fotografiile și datele statice, este verificată înainte de servire: doar IP-ul public de ieșire WireGuard `92.180.22.209` este permis. `run_worker_first: true` este obligatoriu; dezactivarea lui ar expune fișierele statice. Fără `ALLOWED_CLIENT_IP`, accesul este refuzat. API-ul folosește `/api` pe același domeniu; workers.dev și adresele de preview sunt dezactivate. Repository-ul este privat, iar publicarea GitHub Pages este oprită. La schimbarea IP-ului VPN, actualizează `backend/wrangler.jsonc` și redeployează Worker-ul. Traficul utilizatorului către site trebuie să iasă efectiv prin VPN (inclusiv dacă dispozitivul folosește IPv6).

## Editare comună

„Încarcă KMZ” importă puncte, cabluri, pictograme locale PNG/JPEG/WebP și fotografii din descrierile punctelor. Elementele apar în grupul „Importate”, separat pe fișier; alegerea unui strat în popup aplică simbolul și culoarea destinației. La cablu se poate muta întregul traseu sau doar porțiunea START–FINISH. Arhiva este citită local în browser; nu se execută HTML și nu se descarcă pictograme externe. Limite: KMZ 50 MB, maximum 250 de elemente, 2.000 de vârfuri per cablu, 10 MB per fișier și 200 MB dezarhivat. Poligoanele nu sunt importate. Sunt necesare browsere moderne cu DecompressionStream pentru ZIP deflate.

„Undo” anulează ultima acțiune disponibilă din istoricul comun; „Istoric comun” afișează ultimele 200 de importuri și mutări cu data și permite alegerea acțiunii de anulat. Istoricul rămâne în D1 după închiderea aplicației. Conflictele de versiune refuză anularea peste modificări ulterioare; anulează mai întâi mutările mai recente ale acelorași elemente. Anularea importului este permisă după revenirea tuturor elementelor în grupul inițial și eliminarea observațiilor/modificărilor incompatibile. Importurile anulate sunt ascunse, nu șterse fizic; fotografiile și geometria rămân disponibile pentru recuperare administrativă. Migrarea `backend/imports.sql` se execută înainte de publicare. Test local: `node backend/test-imports.mjs`.

„Desenează cablu” începe un traseu nou prin clickuri succesive pe hartă. „Înapoi” elimină ultimul vârf, „Finalizează traseul” deschide numele și sublayerul, iar „Continuă desenarea” revine la hartă. Sunt necesare minimum două poziții distincte. Programarea și patrularea cer săptămâna. Geometria și numele se salvează în D1 prin POST `/api/cables`; traseele noi apar tuturor utilizatorilor VPN și acceptă ulterior porțiuni START–FINISH. Migrarea aditivă `backend/drawn-cables.sql` se execută înainte de publicarea Worker-ului. Test: `node backend/test-drawn-cables.mjs` pe API local cu `wrangler dev --port 8787 --var ALLOWED_CLIENT_IP:127.0.0.1 --upstream-protocol https`.

Patrularea și programarea se pot salva pe porțiuni de cablu. Din popup alege starea, săptămâna și „Selectează START și FINISH pe hartă”, apoi două poziții pe traseu. Pozițiile se fixează pe geometria cablului, inclusiv între vârfurile KML; porțiunea aleasă are previzualizare și marcaje. „Tot cablul” selectează întregul traseu. Înregistrările sunt comune, fiecare cu START, FINISH și săptămână. Restul traseului își păstrează starea, iar la suprapuneri cea mai recentă înregistrare determină culoarea zonei comune. Istoricul înregistrărilor rămâne în popup. Un cablu poate apărea în mai multe sublayere simultan; fiecare bifă controlează doar porțiunile sale din starea respectivă. Numărul din grupul Cabluri reprezintă trasee distincte, nu suma sublayerelor.

Pichetare și Predări de amplasament au sublayerele Solicitate, Programate, Pending și Finalizate. Punctele existente au fost migrate în Finalizate. Pictograma păstrează imaginea colorată originală și primește un simbol de stare (+, calendar, clepsidră sau bifă).

Cablurile au stările Patrulate (verde), Programate pentru patrulare (albastru) și Neprogramate (roz). Starea și săptămânile se modifică din popup. Săptămânile se stochează separat în format ISO `YYYY-Www`: una pentru programare și alta pentru patrularea efectivă. Trecerea între stări păstrează ambele valori. Pentru programare/patrulare se cere săptămâna corespunzătoare. Traseele verzi existente au fost inițial încadrate ca Patrulate fără o săptămână inventată; aceasta poate fi completată manual. Migrarea `backend/cables.sql` și inițializarea `backend/cables-seed.sql` păstrează datele existente.

„Adaugă punct” permite alegerea poziției prin click pe hartă, apoi alegerea stratului. Pentru „Tichete” se introduce numărul tichetului; sublayerul este creat automat sau reutilizat dacă numărul există deja. Numele și adresa sunt opționale. Punctele noi, coordonatele și categoriile lor se salvează în D1 și sunt comune tuturor utilizatorilor.

Fiecare fotografie are butonul „Șterge fotografia”. Ștergerea este înregistrată în D1 și elimină fotografia din galeria comună, inclusiv pentru imaginile importate din KMZ. Fișierele originale din GitHub și obiectele R2 sunt păstrate pentru recuperare administrativă; acest control nu este o ștergere fizică a fișierului.

Pentru bazele existente, migrarea `backend/new-points.sql` adaugă coloanele și tabela pentru fotografii eliminate. Se execută o singură dată. Pentru o bază nouă, schema completă este în `backend/schema.sql`.

Observațiile sunt o listă cu înregistrări distincte, cele mai noi primele. „Adaugă observația” salvează textul și data/ora serverului, afișate în fusul Europe/Bucharest. Salvarea stratului nu adaugă și nu rescrie observațiile. Reîncercarea aceleiași cereri nu creează duplicate. Migrarea `backend/observations.sql` păstrează textele vechi și le marchează cu data ultimei actualizări a punctului, deoarece data originală a observației nu era stocată separat.

În fereastra fiecărui punct poți salva observații, muta punctul pe alt strat, încărca fotografii JPEG/PNG/WebP (maximum 10 MB fiecare) și șterge punctul. Punctele șterse se restaurează din butonul „Puncte șterse”. Fotografiile originale rămân în repository; fotografiile noi sunt în Cloudflare R2. Observațiile, stratul și ștergerile se salvează în Cloudflare D1 prin Worker-ul `tti-api`.

Nu există autentificare individuală: utilizatorii care ies prin IP-ul VPN autorizat pot modifica datele comune. Ștergerea punctelor este reversibilă. Modificările simultane sunt respinse dacă versiunea punctului s-a schimbat; în acest caz încarcă ultima versiune înainte de salvare. Harta se sincronizează la 30 secunde când fereastra de editare este închisă și la revenirea în pagină. Textul introdus nu este executat ca HTML.

Endpoint-ul public este declarat în `dist/config.js`; nu sunt incluse chei API. D1 este `tti-db`, iar R2 `tti-photos`. Codul backend-ului este în `backend/`. Pentru modificări ale API-ului rulează `npx wrangler@4 deploy` din acest director cu sesiunea Cloudflare autorizată. Nu rula seed-ul la un reimport care schimbă identificatorii fără o migrare: ID-urile inițiale din KMZ trebuie păstrate pentru a menține observațiile și fotografiile asociate.

Testele de integrare rulează exclusiv împotriva API-ului local: inițializează schema și seed-ul cu `wrangler d1 execute ... --local`, pornește `wrangler dev --port 8787`, apoi rulează `node backend/test-api.mjs`. Baza locală este separată de cea de producție.

Aplicație statică în română: OpenStreetMap / Mapbox Satellite, un strat comun pentru cabluri și straturi independente pentru fiecare categorie de puncte din KMZ. Simbolurile PNG, culorile și grosimile traseelor sunt importate din KML. Click pe punct deschide fotografiile; click pe fotografie deschide galeria cu navigare prin săgeți și tastatură.

Date inițiale: 37 puncte, 42 trasee, 148 fotografii, 6 categorii. Fișierele foto sunt păstrate local în `dist/files/`, fără servicii externe pentru fotografii. Conținutul descrierilor este tratat ca text, nu ca HTML executabil.

## Pornire

Deschide direct `dist/index.html` în browser. Datele sunt incluse în `data.js`, astfel încât funcționează și prin `file://`, fără server local. Alternativ, instalează Node.js și rulează `npm start` în directorul proiectului, apoi deschide http://127.0.0.1:4173. Nu există dependențe npm. Leaflet 1.9.4 este inclus local. Hărțile de bază necesită internet.

## Reimport

Cu Python 3: `python scripts/import_kmz.py /cale/TTI.kmz`. Importatorul extrage imaginile, rezolvă StyleMap normal, convertește culorile KML AABBGGRR și verifică toate referințele foto. Datele originale nu sunt modificate.

## Hosting

Publică directorul `dist` pe orice hosting static, inclusiv într-un subdirector. Nu sunt necesare chei API sau backend. Fotografiile devin accesibile persoanelor cu acces la site/repository. GitHub Pages nu este activat automat. Atribuirea furnizorilor este afișată pe hartă; pentru utilizare intensă configurează un furnizor de tile-uri adecvat politicilor OpenStreetMap: https://operations.osmfoundation.org/policies/tiles/.

Designul actual folosește o interfață cartografică cu antet bleumarin și accente verzi. Site-ul de referință oroc.proconect.ro nu a putut fi accesat la implementare; potrivirea vizuală exactă rămâne de verificat.

Mapbox Satellite primește tokenul public din endpoint-ul /map-config al backend-ului. Tokenul este configurat în Cloudflare ca MAPBOX_PUBLIC_TOKEN, fără a fi inclus în sursele GitHub. La mutarea site-ului pe un domeniu nou, adaugă domeniul în restricțiile URL ale tokenului Mapbox și în ALLOWED_ORIGINS ale backend-ului Cloudflare. Domeniul existent poate fi păstrat în perioada de tranziție.

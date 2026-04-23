// missions.js - Zuständig für die Generierung der Einsatz-Texte

function generateDynamicPOIMission(poiName, maxSeats, forcedCategory = null) {
    const normalizedName = poiName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss');
    const poiCat = String(forcedCategory || '').toLowerCase();
    const hasWord = (token) => new RegExp(`(^|[^a-z0-9])${String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(normalizedName);
    const maxPax = Math.max(1, maxSeats - 1); 
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const paxVIP = `${maxPax} PAX (VIPs)`;
    const paxMedia = `1-2 PAX (Filmcrew)`;
    const paxGov = `1 PAX (Beobachter)`;
    const paxNone = `0 PAX (Nur Fracht/Sensoren)`;
    
    const cargoMedia = rnd(["Kamera-Gimbal (120 lbs)", "Drohnen & Akkus (80 lbs)", "Teleobjektive (40 lbs)"]);
    const cargoVIP = rnd(["Champagner & Kaviar (15 lbs)", "Luxus-Reisegepäck (100 lbs)", "Picknick-Korb (20 lbs)"]);
    const cargoUtility = rnd(["Lidar-Scanner (180 lbs)", "Wetter-Sensoren (50 lbs)", "Messgeräte (90 lbs)", "Vermessungs-Laser (110 lbs)"]);

    let templates = [];

    if (poiCat === "bridge" || normalizedName.includes("bruecke") || normalizedName.includes("brucke") || normalizedName.includes("bridge") || normalizedName.includes("viadukt") || normalizedName.includes("aquadukt") || normalizedName.includes("steg") || normalizedName.includes("pont") || normalizedName.includes("puente")) {
        templates = [
            { i: "🌉", t: `Struktur-Prüfung: ${poiName}`, s: `Das Verkehrsministerium beauftragt dich mit einer Riss- und Statikprüfung der Pfeiler von ${poiName}. Fliege mehrere langsame Pässe.`, p: paxGov, w: cargoUtility },
            { i: "🚄", t: `Verkehrs-Studie: ${poiName}`, s: `Ein Ingenieurbüro plant eine Erweiterung der Verkehrswege bei ${poiName}. Dokumentiere den Verkehrsfluss zur Hauptverkehrszeit aus der Luft.`, p: paxGov, w: "Kamera-Gimbal (120 lbs)" },
            { i: "🎬", t: `Action-Dreh: ${poiName}`, s: `Eine Filmcrew dreht eine Verfolgungsjagd über ${poiName}. Du lieferst die dynamischen Luftaufnahmen für den Blockbuster.`, p: paxMedia, w: cargoMedia },
            { i: "🚁", t: `Instandhaltung: ${poiName}`, s: `Wartungstrupps benötigen einen Überblick über die schwer zugänglichen Stahlseile und Bögen von ${poiName}.`, p: "1 PAX (Ingenieur)", w: cargoUtility },
            { i: "🧰", t: `Brücken-Techniker Shuttle: ${poiName}`, s: `Ein Statik-Techniker muss dringend zur Sichtprüfung an ${poiName}. Fliege stabil und liefere ihn direkt in den Einsatzraum.`, p: "1 PAX (Brücken-Techniker)", w: "Messkoffer & Laser (70 lbs)" }
        ];
    }
    else if (poiCat === "road" || normalizedName.includes("autobahn") || normalizedName.includes("kreuz") || normalizedName.includes("dreieck") || normalizedName.includes("strasse") || normalizedName.includes("highway") || normalizedName.includes("motorway") || normalizedName.includes("interstate") || normalizedName.includes("freeway") || normalizedName.includes("ring") || normalizedName.includes("junction") || normalizedName.includes("tunnel")) {
        templates = [
            { i: "🚗", t: `Stau-Report: ${poiName}`, s: `Verkehrschaos zur Rush-Hour! Fliege den Bereich um ${poiName} ab und melde Rückstaus live an den lokalen Radiosender.`, p: paxMedia, w: "Funktechnik & Reporter (190 lbs)" },
            { i: "🛣️", t: `Trassen-Inspektion: ${poiName}`, s: `Das Straßenbauamt bittet um einen 10 km langen Abflug der Fahrbahn entlang ${poiName}. Dokumentiere massive Frostschäden.`, p: paxGov, w: cargoUtility },
            { i: "🚓", t: `Polizei-Support: ${poiName}`, s: `Schwerer LKW-Unfall gemeldet. Die Polizei benötigt dringend hochauflösende Luftaufnahmen zur Rekonstruktion des Hergangs nahe ${poiName}.`, p: "1 PAX (Polizeifotograf)", w: "Kamera-Equipment (30 lbs)" },
            { i: "🚚", t: `Schwerlast-Eskorte: ${poiName}`, s: `Ein extremer Schwertransport blockiert die Route bei ${poiName}. Das Planungsbüro braucht ein Auge in der Luft für Engstellen.`, p: paxGov, w: "Live-Link Antennen (50 lbs)" },
            { i: "🦺", t: `Autobahn-Technikflug: ${poiName}`, s: `Ein Straßen-Technikerteam prüft Brückenfugen und Schallschutz bei ${poiName}. Du lieferst die Crew an die kritischen Abschnitte aus der Luft.`, p: "1 PAX (Straßen-Techniker)", w: "Inspektionskoffer (60 lbs)" }
        ];
    }
    else if (poiCat === "telecom" || normalizedName.includes("funkturm") || normalizedName.includes("fernsehturm") || normalizedName.includes("sendemast") || normalizedName.includes("funkmast") || normalizedName.includes("mast") || normalizedName.includes("tower")) {
        templates = [
            { i: "📡", t: `Funkmast-Inspektion: ${poiName}`, s: `Der Betreiber meldet Auffälligkeiten an den Abspannungen von ${poiName}. Fliege ruhige Kreise für die Sichtkontrolle.`, p: "1 PAX (Funk-Techniker)", w: "Messkoffer & Richtantenne (85 lbs)" },
            { i: "🛰️", t: `Signal-Check: ${poiName}`, s: `Ein Telekom-Team misst die Versorgung rund um ${poiName}. Halte stabilen Kurs für reproduzierbare Daten.`, p: "1 PAX (Netztechniker)", w: "Spektrumanalysator (55 lbs)" },
            { i: "🔧", t: `Wartungs-Shuttle: ${poiName}`, s: `Ein Servicetechniker muss mit Werkzeug und Ersatzteilen zu ${poiName}. Bringe ihn zügig und ohne Hektik ins Einsatzgebiet.`, p: "1 PAX (Servicetechniker)", w: "Werkzeugkiste (70 lbs)" }
        ];
    }
    else if (poiCat === "dam" || hasWord("staudamm") || hasWord("talsperre") || hasWord("stausee") || hasWord("sperrmauer") || hasWord("reservoir") || hasWord("damm") || hasWord("dam") || hasWord("wehr")) {
        templates = [
            { i: "🧱", t: `Staudamm-Inspektion: ${poiName}`, s: `Die Wasserbehörde meldet mögliche Risse an der Sperrmauer von ${poiName}. Fliege mehrere ruhige Pässe entlang der Staumauer.`, p: "1 PAX (Talsperren-Techniker)", w: "Rissmonitor & Messlaser (95 lbs)" },
            { i: "💦", t: `Hochwasser-Check: ${poiName}`, s: `Nach Starkregen soll die Entlastungsanlage von ${poiName} geprüft werden. Dokumentiere Überläufe und Wasserkanten präzise aus der Luft.`, p: paxGov, w: "Wetter-Sensoren (50 lbs)" },
            { i: "🔩", t: `Wartungsflug: ${poiName}`, s: `Ein Instandhaltungsteam kontrolliert Schieber, Wehrfelder und Uferbefestigungen an ${poiName}. Du hältst die Plattform für stabile Sichtfenster.`, p: "1 PAX (Wasserbau-Techniker)", w: "Werkzeugkiste (70 lbs)" },
            { i: "📷", t: `Bauwerks-Dokumentation: ${poiName}`, s: `Für das Jahresgutachten der Talsperre ${poiName} sind neue Luftbilder nötig. Fliege präzise entlang Krone und Wasserseite.`, p: "1 PAX (Bauwerksgutachter)", w: "Kamera-Gimbal (120 lbs)" }
        ];
    }
    else if (poiCat === "industry" || normalizedName.includes("industrie") || normalizedName.includes("werk") || normalizedName.includes("fabrik") || normalizedName.includes("kraftwerk") || normalizedName.includes("anlage") || normalizedName.includes("mine") || normalizedName.includes("tagebau")) {
        templates = [
            { i: "🏭", t: `Industrie-Inspektion: ${poiName}`, s: `Die Werksleitung von ${poiName} benötigt detaillierte Wärmebildaufnahmen der Kühltürme und Schornsteine. Halte dich genau an die freigegebene Höhe!`, p: paxGov, w: "Infrarot-Scanner (80 lbs)" },
            { i: "☢️", t: `Emissions-Messung: ${poiName}`, s: `Das Umweltamt will die Abgaswerte über ${poiName} überprüfen. Fliege mit den montierten Sensoren mehrfach quer durch die Abluftfahne.`, p: paxNone, w: "Luft-Sniffer & Sensoren (120 lbs)" },
            { i: "📸", t: `PR-Flug: ${poiName}`, s: `Der Konzern braucht neue, dynamische Aufnahmen des riesigen Geländes von ${poiName} für den nächsten Jahresbericht.`, p: paxMedia, w: cargoMedia },
            { i: "🏗️", t: `Baufortschritt: ${poiName}`, s: `Eine gigantische neue Produktionshalle entsteht bei ${poiName}. Dokumentiere den Fortschritt von oben für die Großinvestoren.`, p: paxVIP, w: "Laptops & Pläne (40 lbs)" },
            { i: "🔥", t: `Gefahren-Abwehr: ${poiName}`, s: `Es gab eine Verpuffung in einem der Silos bei ${poiName}. Der Einsatzleiter der Feuerwehr ist an Bord und verschafft sich einen Überblick.`, p: "1 PAX (Einsatzleiter)", w: "Funk-Relais (50 lbs)" }
        ];
    }
    else if (poiCat === "infrastructure" || normalizedName.includes("bahn") || normalizedName.includes("gleis") || normalizedName.includes("rail") || normalizedName.includes("railway") || normalizedName.includes("umspannwerk") || normalizedName.includes("hochspannung") || normalizedName.includes("freileitung") || normalizedName.includes("stromtrasse")) {
        templates = [
            { i: "🛠️", t: `Infrastruktur-Inspektion: ${poiName}`, s: `Ein Infrastruktur-Team prüft bei ${poiName} Straßen-, Bahn- und Energietrassen auf Schäden. Halte ruhige, reproduzierbare Überflüge.`, p: "1 PAX (Infrastruktur-Techniker)", w: "Inspektionskoffer und Tablet (42 lbs)" },
            { i: "📐", t: `Trassen-Vermessung: ${poiName}`, s: `Für ${poiName} läuft ein Vermessungsflug entlang von Verkehrs- und Stromkorridoren. Fliege stabil mit klaren Sichtfenstern für die Auswertung.`, p: "1 PAX (Vermessung)", w: "Lidar- und Messpaket (88 lbs)" },
            { i: "🚨", t: `Korridor-Kontrollflug: ${poiName}`, s: `Nach einem gemeldeten Vorfall soll der Abschnitt bei ${poiName} entlang Straße, Schiene und Trasse aus der Luft kontrolliert werden.`, p: "1 PAX (Kontrollingenieur)", w: "Dokukit und Wärmekamera (54 lbs)" },
            { i: "🛰️", t: `Netz-Check: ${poiName}`, s: `Ein Technikteam bewertet die Netzinfrastruktur bei ${poiName} und braucht präzise Luftaufnahmen von Masten, Knoten und Trassenverlauf.`, p: "1 PAX (Netztechniker)", w: "Spektrumanalysator und Kamera (63 lbs)" }
        ];
    }
    else if (poiCat === "castle" || normalizedName.includes("burg") || normalizedName.includes("schloss") || normalizedName.includes("ruine") || normalizedName.includes("festung") || normalizedName.includes("kloster") || normalizedName.includes("dom") || normalizedName.includes("monument") || normalizedName.includes("denkmal")) {
        templates = [
            { i: "🏰", t: `Historik-Flug: ${poiName}`, s: `Ein Historiker benötigt hochauflösende Luftaufnahmen von ${poiName}, um alte Mauerstrukturen im Umland zu erkennen. Kreise mehrmals in ruhiger Höhe.`, p: paxGov, w: cargoMedia },
            { i: "🥂", t: `Hochzeits-Tour: ${poiName}`, s: `Ein frisch vermähltes Paar hat einen exklusiven Rundflug gebucht. Zeige ihnen ${poiName} von seiner romantischsten Seite.`, p: paxVIP, w: cargoVIP },
            { i: "🎬", t: `Location Scout: ${poiName}`, s: `Ein Regisseur aus Hollywood sucht nach Drehorten für einen neuen Mittelalter-Blockbuster. Er will prüfen, ob sich ${poiName} als Kulisse eignet.`, p: paxMedia, w: cargoMedia },
            { i: "🛠️", t: `Denkmalschutz: ${poiName}`, s: `Nach einem schweren Sturm befürchtet das Amt für Denkmalschutz Dachschäden an ${poiName}. Führe einen langsamen Inspektionsflug durch.`, p: paxGov, w: cargoUtility },
            { i: "👻", t: `Mystery-Flug: ${poiName}`, s: `Ein reicher Fan von Mythen und Legenden hat dich gebucht. Er glaubt fest daran, dass es bei ${poiName} spukt und will den Ort aus der Luft beobachten.`, p: paxVIP, w: "Ferngläser & EMF-Meter (10 lbs)" }
        ];
    } 
    else if (poiCat === "water" || normalizedName.includes("fluss") || normalizedName.includes("strom") || normalizedName.includes("kanal") || normalizedName.includes("see") || normalizedName.includes("talsperre") || normalizedName.includes("teich") || normalizedName.includes("insel") || normalizedName.includes("weiher") || normalizedName.includes("kueste") || normalizedName.includes("hafen") || normalizedName.includes("river") || normalizedName.includes("lake") || normalizedName.includes("bay") || normalizedName.includes("fjord") || normalizedName.includes("meer") || normalizedName.includes("rhein") || normalizedName.includes("donau") || normalizedName.includes("elbe") || normalizedName.includes("isar") || normalizedName.includes("neckar")) {
        templates = [
            { i: "💧", t: `Pegel-Messung: ${poiName}`, s: `Die Wasserbehörde muss den aktuellen Wasserstand und mögliche Ufer-Erosionen bei ${poiName} dokumentieren.`, p: paxNone, w: cargoUtility },
            { i: "🚢", t: `Schifffahrts-Kontrolle: ${poiName}`, s: `Die Flusswacht benötigt ein Update über die aktuelle Schiffsdichte und mögliche Blockaden bei ${poiName}.`, p: paxGov, w: cargoUtility },
            { i: "🌊", t: `Hochwasser-Schutz: ${poiName}`, s: `Nach starken Regenfällen müssen Dämme und Uferbefestigungen entlang ${poiName} dringend auf Schwachstellen geprüft werden.`, p: paxGov, w: "Infrarot-Scanner (80 lbs)" },
            { i: "🦆", t: `Natur-Beobachtung: ${poiName}`, s: `Ein Biologe möchte Wasservögel zählen, die momentan im Gebiet rund um ${poiName} rasten. Halte genug Abstand, um die Tiere nicht zu erschrecken!`, p: paxGov, w: "Teleobjektive (40 lbs)" },
            { i: "🛶", t: `Werbedreh: ${poiName}`, s: `Der Tourismusverband will neue, dynamische Aufnahmen von Wassersportlern bei ${poiName}. Fliege tief und ruhig für die Kameracrew.`, p: paxMedia, w: cargoMedia }
        ];
    } 
    else if (poiCat === "mountain" || normalizedName.includes("berg") || normalizedName.includes("spitze") || normalizedName.includes("horn") || normalizedName.includes("gipfel") || normalizedName.includes("kogel") || normalizedName.includes("wald") || normalizedName.includes("tal") || normalizedName.includes("schlucht") || normalizedName.includes("alpen") || normalizedName.includes("pass")) {
        templates = [
            { i: "⛰️", t: `Topo-Scan: ${poiName}`, s: `Das Landesvermessungsamt aktualisiert die 3D-Karten der Region. Fliege ein präzises Raster über ${poiName} ab, damit der Laser scannen kann.`, p: paxNone, w: cargoUtility },
            { i: "🌲", t: `Forst-Patrouille: ${poiName}`, s: `Wegen starker Trockenheit ist die Waldbrandgefahr extrem hoch. Patrouilliere das Gebiet um ${poiName} und halte Ausschau nach Rauchentwicklung.`, p: paxGov, w: "Infrarot-Kamera (60 lbs)" },
            { i: "🧗", t: `Extremsport-Support: ${poiName}`, s: `Ein Red-Bull-Athlet plant einen waghalsigen Stunt bei ${poiName}. Sein Team muss das Terrain vorher aus der Luft genau studieren.`, p: paxMedia, w: cargoMedia },
            { i: "❄️", t: `Lawinen-Check: ${poiName}`, s: `Die Bergwacht befürchtet, dass Hänge rund um ${poiName} instabil sein könnten. Führe einen vorsichtigen Sichtflug durch, um Schneemassen zu bewerten.`, p: paxGov, w: "Avalanche-Beacons (20 lbs)" },
            { i: "📸", t: `Kalender-Shooting: ${poiName}`, s: `Ein bekannter Naturfotograf braucht das perfekte Bild von ${poiName} für das Cover seines neuen Alpen-Kalenders.`, p: paxMedia, w: cargoMedia }
        ];
    } 
    else if (poiCat === "city" || normalizedName.includes("stadt") || normalizedName.includes("turm") || normalizedName.includes("park") || normalizedName.includes("stadion") || normalizedName.includes("arena") || normalizedName.includes("zentrum") || normalizedName.includes("city")) {
        templates = [
            { i: "🏙️", t: `City-Panorama: ${poiName}`, s: `Eine Reisegruppe aus Übersee hat eine VIP-Städtetour gebucht. Das Highlight der Route ist ganz klar ${poiName}.`, p: `${maxPax} PAX (Touristen)`, w: cargoVIP },
            { i: "🏗️", t: `Bauaufsicht: ${poiName}`, s: `Das Ingenieurbüro verlangt hochauflösende Aufnahmen von der Statik und dem Zustand der Anlagen bei ${poiName}.`, p: paxGov, w: cargoUtility },
            { i: "🚗", t: `Verkehrs-Überwachung`, s: `Es ist Rush-Hour. Ein local Radiosender hat dich gemietet, um das Verkehrschaos rund um ${poiName} live von oben zu reportieren.`, p: "1 PAX (Radiomoderator)", w: "Funktechnik (40 lbs)" },
            { i: "🎆", t: `Event-Vorbereitung: ${poiName}`, s: `Ein Mega-Event steht an. Die Organisatoren wollen das Gelände rund um ${poiName} aus der Luft begutachten, um Fluchtwege zu planen.`, p: "2 PAX (Security)", w: "Pläne & Laptops (30 lbs)" },
            { i: "🏢", t: `Immobilien-Flug: ${poiName}`, s: `Ein Großinvestor überlegt, Ländereien nahe ${poiName} zu kaufen. Zeige ihm, wie sich die Infrastruktur von oben präsentiert.`, p: paxVIP, w: cargoVIP }
        ];
    } 
    else {
        templates = [
            { i: "✈️", t: `Panoramaflug: ${poiName}`, s: `Ein klassischer Ausflugsflug zum Zielort: ${poiName}. Die Fluggäste freuen sich auf einen ruhigen Flug und tolle Ausblicke!`, p: `${maxPax} PAX`, w: "Reisegepäck (30 lbs)" },
            { i: "📸", t: `Foto-Tour: ${poiName}`, s: `Du wurdest gebucht, um die Sehenswürdigkeit ${poiName} im perfekten Licht aus der Luft abzulichten.`, p: paxMedia, w: cargoMedia },
            { i: "🎁", t: `Überraschungsflug: ${poiName}`, s: `Jemand hat diesen Flug nach ${poiName} zum Geburtstag geschenkt bekommen. Mache es zu einem unvergesslichen Erlebnis!`, p: `${maxPax} PAX`, w: cargoVIP },
            { i: "🎓", t: `Nav-Übung: ${poiName}`, s: `Heute kein Charter-Kunde! Du zeigst einem Flugschüler, wie er sauber nach VFR nach ${poiName} navigiert.`, p: "1 PAX (Flugschüler)", w: "Flugtaschen (20 lbs)" },
            { i: "📡", t: `Funk-Relais: ${poiName}`, s: `Kreise über ${poiName}, um als fliegendes Kommunikationsrelais für ein lokales Event zu fungieren.`, p: paxNone, w: "Zusatz-Antennen (80 lbs)" },
            { i: "🛩️", t: `Luftraum-Check: ${poiName}`, s: `ATC hat unidentifizierte VFR-Aktivitäten bei ${poiName} gemeldet. Fliege hin und überprüfe die Lage visuell.`, p: "0 PAX", w: "Standard-Ausrüstung" }
        ];
    }

    // =========================================
    // SHUFFLE-BAG SYSTEM FÜR POIS 
    // =========================================
    let history = JSON.parse(localStorage.getItem('ga_poi_history')) || [];
    
    // Sortiere Missionstypen aus, die kürzlich schon dran waren (Wir extrahieren "Topo-Scan" aus "Topo-Scan: Zugspitze")
    let freshTemplates = templates.filter(tmpl => !history.includes(tmpl.t.split(':')[0]));
    
    // Wenn alle aus dieser Kategorie schon in der History sind, wird neu gemischt!
    if (freshTemplates.length === 0) { 
        freshTemplates = templates; 
        history = []; 
    }
    
    // Zufällige Auswahl aus dem verbleibenden frischen Stapel
    const selected = rnd(freshTemplates);

    // Missionsart merken (max 6 Stück im Gedächtnis, damit Kategorien mit 4 Items rotieren können)
    history.push(selected.t.split(':')[0]);
    if(history.length > 6) history.shift();
    localStorage.setItem('ga_poi_history', JSON.stringify(history));

    return { 
        i: selected.i, 
        t: selected.t, 
        s: selected.s, 
        cat: "poi", 
        payloadText: selected.p, 
        cargoText: selected.w 
    };
}

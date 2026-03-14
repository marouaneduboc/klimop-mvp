#!/usr/bin/env node
/**
 * 1) Add new vocab to klimop.json to reach 200 per theme.
 * 2) Extract verbs from klimop + windmee and add to grammar.json.
 */

const fs = require('fs');
const path = require('path');

const KLIMOP_PATH = path.join(__dirname, '../apps/web/public/content/klimop.json');
const WINDMEE_PATH = path.join(__dirname, '../apps/web/public/content/windmee.json');
const GRAMMAR_PATH = path.join(__dirname, '../apps/web/public/content/grammar.json');

// --- Theme titles for reference ---
// 1=Kennismaken, 2=Hoe gaat het?, 3=Familie, 4=Dagelijkse activiteiten, 5=De tijd, 6=Afspreken, 7=Eten en drinken, 8=Boodschappen, 9=Winkelen, 10=Gezondheid

// A0/A1 words per theme: [nl, article|null, en]. No duplicates with existing.
const POOL_1 = [ // Kennismaken
  ['achternaam','de','surname'],['voornaam','de','first name'],['gebruiker','de','user'],['adres','het','address'],['formulier','het','form'],
  ['paspoort','het','passport'],['visum','het','visa'],['nationaliteit','de','nationality'],['beroep','het','occupation'],['leeftijd','de','age'],
  ['buren','de','neighbours'],['collega','de','colleague'],['kennissen','de','acquaintances'],['introductie','de','introduction'],['handtekening','de','signature'],
  ['geboortedatum','de','date of birth'],['geboorteplaats','de','place of birth'],['achtergrond','de','background'],['wijk','de','district'],['straat','de','street'],
  ['postcode','de','postal code'],['telefoonnummer','het','phone number'],['e-mailadres','het','email address'],['website','de','website'],['profiel','het','profile'],
  ['naam','de','name'],['land','het','country'],['stad','de','city'],['dorp','het','village'],['regio','de','region'],
  ['taalcursus','de','language course'],['les','de','lesson'],['klas','de','class'],['school','de','school'],['universiteit','de','university'],
  ['student','de','student'],['docent','de','teacher'],['groep','de','group'],['maatje','het','buddy'],['uitwisseling','de','exchange'],
  ['verhuizing','de','move'],['nieuwkomer','de','newcomer'],['inwoner','de','resident'],['bezoeker','de','visitor'],['gast','de','guest'],
  ['hobby','de','hobby'],['interesse','de','interest'],['gezin','het','family'],['thuis','','at home'],['hier','','here'],['daar','','there'],['overal','','everywhere'],
  ['spreekvaardigheid','de','speaking skill'],['luistervaardigheid','de','listening skill'],['uitspraak','de','pronunciation'],['grammatica','de','grammar'],['woordenschat','de','vocabulary'],
  ['niveau','het','level'],['certificaat','het','certificate'],['diploma','het','diploma'],['inschrijving','de','registration'],['cursusgeld','het','course fee'],
  ['medestudent','de','fellow student'],['leslokaal','het','classroom'],['schoolgebouw','het','school building'],['kantine','de','canteen'],['bibliotheek','de','library'],
  ['studiebegeleiding','de','study guidance'],['tentamen','het','exam'],['herkansing','de','resit'],['opdracht','de','assignment'],['presentatie','de','presentation'],
  ['gesprekspartner','de','conversation partner'],['taalmaatje','het','language buddy'],['moedertaal','de','mother tongue'],['tweede taal','',null],['vreemde taal','',null],
  ['werkgever','de','employer'],['werknemer','de','employee'],['stage','de','internship'],['sollicitatie','de','application'],['cv','het','CV'],
  ['geboorteland','het','country of birth'],['woonplaats','de','place of residence'],['gezinsleden','de','family members'],['samenwonend','','cohabiting'],
  ['gebruikersnaam','de','username'],['wachtwoord','het','password'],['inloggen','',null],['uitloggen','',null],['account','het','account'],
  ['profiel','het','profile'],['foto','de','photo'],['avatar','de','avatar'],['nickname','de','nickname'],['handtekening','de','signature'],
  ['formulier','het','form'],['veld','het','field'],['optie','de','option'],['keuze','de','choice'],  ['aanmelden','',null],['inschrijfformulier','het','registration form'],['cursusmateriaal','het','course material'],['lesrooster','het','timetable'],['syllabus','de','syllabus'],  ['leerdoel','het','learning objective'],['taalniveau','het','language level'],['instroomniveau','het','entry level'],['doorstroom','de','progression'],['certificering','de','certification'],
];
const POOL_2 = [ // Hoe gaat het?
  ['gevoel','het','feeling'],['humeur','het','mood'],['stress','de','stress'],['tevreden','',null],['blij','','happy'],
  ['verdrietig','','sad'],['boos','','angry'],['moe','','tired'],['ziek','','ill'],['fit','','fit'],
  ['zenuwachtig','','nervous'],['optimistisch','','optimistic'],['pessimistisch','','pessimistic'],['eenzaam','','lonely'],['ontspannen','','relaxed'],
  ['energie','de','energy'],['slaap','de','sleep'],['rust','de','rest'],['gezondheid','de','health'],['welzijn','het','wellbeing'],
  ['dag','de','day'],['week','de','week'],['maand','de','month'],['jaar','het','year'],['moment','het','moment'],
  ['vandaag','','today'],['gisteren','','yesterday'],['morgen','','tomorrow'],['straks','','later'],['nu','','now'],
  ['snel','','fast'],['langzaam','','slow'],['goed','','good'],['slecht','','bad'],['normaal','','normal'],
  ['beter','','better'],['erger','','worse'],['best','','best'],['slechtst','','worst'],['fijn','','nice'],
  ['prima','','fine'],['oké','','okay'],['eigenlijk','','actually'],['natuurlijk','','of course'],['inderdaad','','indeed'],
  ['misschien','','maybe'],['waarschijnlijk','','probably'],['zeker','','certainly'],['helaas','','unfortunately'],['gelukkig','','fortunately'],
  ['gewoon','','just'],['echt','','really'],['helemaal','','completely'],['bijna','','almost'],['al','','already'],
  ['nog','','still'],['weer','','again'],['altijd','','always'],['soms','','sometimes'],['nooit','','never'],
  ['emotie','de','emotion'],['gevoelsleven','het','emotional life'],['spanning','de','tension'],['ontspanning','de','relaxation'],['tevredenheid','de','satisfaction'],
  ['onvrede','de','dissatisfaction'],['enthousiasme','het','enthusiasm'],['verveling','de','boredom'],['angst','de','fear'],['bezorgdheid','de','worry'],
  ['opluchting','de','relief'],['verbazing','de','surprise'],['woede','de','anger'],['jaloezie','de','jealousy'],['trots','de','pride'],
  ['schaamte','de','shame'],['spijt','de','regret'],['verlangen','het','longing'],['verwachting','de','expectation'],['teleurstelling','de','disappointment'],
  ['humor','de','humour'],['lach','de','laugh'],['glimlach','de','smile'],['traan','de','tear'],['zucht','de','sigh'],
  ['gezichtsuitdrukking','de','facial expression'],['lichaamstaal','de','body language'],['houding','de','posture'],['uitstraling','de','aura'],['indruk','de','impression'],
  ['gemoedstoestand','de','mood'],['welbevinden','het','wellbeing'],['levenslust','de','zest for life'],['drukte','de','busyness'],  ['rustmoment','het','moment of rest'],['gemoedsrust','de','peace of mind'],['stressniveau','het','stress level'],['overspannen','','overwrought'],['burn-out','de','burnout'],  ['ontspanningsoefening','de','relaxation exercise'],['stiefbroer','de','stepbrother'],['stiefzuster','de','stepsister'],['halfbroer','de','half-brother'],['halfzuster','de','half-sister'],
  ['schoonbroer','de','brother-in-law'],['schoonzuster','de','sister-in-law'],['zwager','de','brother-in-law'],['schoonzus','de','sister-in-law'],  ['schoonfamilie','de','in-laws'],['ouderschap','het','parenthood'],['gezinsleven','het','family life'],['familieband','de','family tie'],['stamboomonderzoek','het','genealogy'],
  ['gezinsuitbreiding','de','family expansion'],['geboorteaangifte','de','birth registration'],['gezinsplanning','de','family planning'],['kindertal','het','number of children'],  ['eenoudergezin','het','single-parent family'],['ouderschap','het','parenthood'],['gezinsleven','het','family life'],['familieband','de','family tie'],['stamboomonderzoek','het','genealogy'],
  ['gezinsuitbreiding','de','family expansion'],['geboorteaangifte','de','birth registration'],['kindertal','het','number of children'],['schoonbroer','de','brother-in-law'],['schoonzuster','de','sister-in-law'],
  ['halfzuster','de','half-sister'],['stiefzuster','de','stepsister'],['peetoom','de','godfather'],['peettante','de','godmother'],['peter','de','godfather'],['roepnaam','de','nickname'],
];
const POOL_3 = [ // Familie
  ['ouderschap','het','parenthood'],['gezinsleven','het','family life'],['familieband','de','family tie'],['stamboomonderzoek','het','genealogy'],['gezinsuitbreiding','de','family expansion'],
  ['geboorteaangifte','de','birth registration'],['kindertal','het','number of children'],['schoonbroer','de','brother-in-law'],['schoonzuster','de','sister-in-law'],['halfzuster','de','half-sister'],
  ['opa','de','grandfather'],['oma','de','grandmother'],['kleinkind','het','grandchild'],['kleinzoon','de','grandson'],['kleindochter','de','granddaughter'],
  ['neef','de','cousin'],['nicht','de','cousin'],['oom','de','uncle'],['tante','de','aunt'],['schoonfamilie','de','in-laws'],
  ['schoonvader','de','father-in-law'],['schoonmoeder','de','mother-in-law'],['stiefvader','de','stepfather'],['stiefmoeder','de','stepmother'],['stiefkind','het','stepchild'],
  ['peetvader','de','godfather'],['peetmoeder','de','godmother'],['petekind','het','godchild'],['familielid','het','family member'],['verwanten','de','relatives'],
  ['echtgenoot','de','husband'],['echtgenote','de','wife'],['partner','de','partner'],['ex','de','ex'],['weduwe','de','widow'],
  ['weduwnaar','de','widower'],['wees','de','orphan'],['adoptie','de','adoption'],['tweeling','de','twins'],['eenling','de','only child'],
  ['geboorte','de','birth'],['huwelijk','het','marriage'],['bruiloft','de','wedding'],['verloving','de','engagement'],['scheiding','de','divorce'],
  ['relatie','de','relationship'],['huishouden','het','household'],['thuiswonend','',null],['uitwonend','',null],['samenwonen','',null],
  ['liefde','de','love'],['trouwen','',null],['verliefd','','in love'],['alleenstaand','','single'],['verloofd','','engaged'],
  ['gehuwd','','married'],['gescheiden','','divorced'],['zwanger','','pregnant'],['baby','de','baby'],['peuter','de','toddler'],
  ['puber','de','teenager'],['volwassene','de','adult'],['ouder','de','parent'],['generatie','de','generation'],['stamboom','de','family tree'],
  ['erfenis','de','inheritance'],['testament','het','will'],['voogd','de','guardian'],['voogdij','de','custody'],['alimentatie','de','alimony'],
  ['geboorteakte','de','birth certificate'],['huwelijksakte','de','marriage certificate'],['familienaam','de','family name'],['meisjesnaam','de','maiden name'],['achternaam','de','surname'],
  ['bloedverwantschap','de','blood relation'],['aangetrouwde','de','in-law'],['pleeggezin','het','foster family'],['pleegkind','het','foster child'],['adoptieouders','de','adoptive parents'],
  ['gezinsplanning','de','family planning'],['kinderwens','de','desire to have children'],  ['eenoudergezin','het','single-parent family'],['samengesteld gezin','',null],['patchworkgezin','het','blended family'],
  ['erflater','de','testator'],['erfgenaam','de','heir'],['nalatenschap','de','estate'],['erfenis','de','inheritance'],['erfenis','de','legacy'],
  ['voornaam','de','first name'],['roepnaam','de','nickname'],['geboortedatum','de','date of birth'],['geboortestad','de','birth city'],  ['geboorteland','het','country of birth'],['stamboom','de','family tree'],['voorouder','de','ancestor'],['nakomeling','de','descendant'],['bloedverwant','de','blood relative'],['aanverwant','de','relative by marriage'],
  ['peetoom','de','godfather'],['peettante','de','godmother'],['meter','de','godmother'],['peter','de','godfather'],['pleegouder','de','foster parent'],['adoptieouder','de','adoptive parent'],
];
const POOL_4 = [ // Dagelijkse activiteiten
  ['ochtend','de','morning'],['middag','de','afternoon'],['avond','de','evening'],['nacht','de','night'],['dagritme','het','daily routine'],
  ['wekker','de','alarm clock'],['ontbijt','het','breakfast'],['lunch','de','lunch'],['diner','het','dinner'],['snack','de','snack'],
  ['koffie','de','coffee'],['thee','de','tea'],['melk','de','milk'],['sap','het','juice'],['water','het','water'],
  ['brood','het','bread'],['boterham','de','sandwich'],['ei','het','egg'],['pap','de','porridge'],['muesli','de','muesli'],
  ['krant','de','newspaper'],['boek','het','book'],['radio','de','radio'],['tv','de','tv'],['computer','de','computer'],
  ['telefoon','de','phone'],['tablet','de','tablet'],['internet','het','internet'],['app','de','app'],['bericht','het','message'],
  ['badkamer','de','bathroom'],['slaapkamer','de','bedroom'],['keuken','de','kitchen'],['woonkamer','de','living room'],['bureau','het','desk'],
  ['bed','het','bed'],['bank','de','sofa'],['tafel','de','table'],['stoel','de','chair'],['kast','de','cupboard'],
  ['douche','de','shower'],['wastafel','de','washbasin'],['spiegel','de','mirror'],['handdoek','de','towel'],['zeep','de','soap'],
  ['tandenborstel','de','toothbrush'],['tandpasta','de','toothpaste'],['kam','de','comb'],['scheermes','het','razor'],['make-up','de','makeup'],
  ['kleding','de','clothes'],['jas','de','coat'],['broek','de','trousers'],['rok','de','skirt'],['trui','de','sweater'],
  ['sokken','de','socks'],['onderbroek','de','underpants'],['pyjama','de','pyjamas'],['laarzen','de','boots'],
  ['wekkertje','het','alarm clock'],['slaapkamer','de','bedroom'],['beddegoed','het','bedding'],['kussen','het','pillow'],['deken','de','blanket'],
  ['wasbak','de','washbasin'],['wc','de','toilet'],['douchekop','de','shower head'],['kraan','de','tap'],['spiegel','de','mirror'],
  ['schemerlamp','de','bedside lamp'],['nachttafel','de','nightstand'],['kleerkast','de','wardrobe'],['ladekast','de','chest of drawers'],['vloer','de','floor'],
  ['gordijn','het','curtain'],['vensterbank','de','windowsill'],['balkon','het','balcony'],['dakterras','het','rooftop terrace'],['tuin','de','garden'],
  ['fietssleutel','de','bike key'],['sleutelbos','de','key ring'],  ['bril','de','glasses'],['contactlenzen','de','contact lenses'],['parfum','het','perfume'],
  ['wekker','de','alarm clock'],['snooze','de','snooze'],['ochtendritueel','het','morning routine'],['avondritueel','het','evening routine'],['slaapritme','het','sleep rhythm'],
  ['badkamer','de','bathroom'],['toilet','het','toilet'],['douche','de','shower'],['wastafel','de','washbasin'],['handdoek','de','towel'],
  ['tandenborstel','de','toothbrush'],['tandpasta','de','toothpaste'],['zeep','de','soap'],['shampoo','de','shampoo'],['deodorant','de','deodorant'],
  ['kledingkast','de','wardrobe'],['ladekast','de','chest of drawers'],['spiegel','de','mirror'],['kapstok','de','coat rack'],  ['schoenrek','het','shoe rack'],['wasmachine','de','washing machine'],['droger','de','tumble dryer'],['strijkijzer','het','iron'],['stofzuiger','de','vacuum cleaner'],['vaatwasser','de','dishwasher'],
  ['vloerbedekking','de','floor covering'],['tapijt','het','carpet'],['tegel','de','tile'],['behang','het','wallpaper'],  ['verf','de','paint'],['nanoseconde','de','nanosecond'],['milliseconde','de','millisecond'],['kwartier','het','quarter of an hour'],['halfuur','het','half an hour'],
  ['hele uur','',null],['uurwerk','het','clock'],['zandloper','de','hourglass'],['chronologie','de','chronology'],['tijdspanne','de','time span'],
  ['tijdperk','het','era'],['tijdvak','het','period'],['tijdsbestek','het','time frame'],['verloop','het','passage of time'],  ['tijdigheid','de','timeliness'],['tijdwinst','de','time saved'],['tijdsverlies','het','time lost'],['tijdindeling','de','time allocation'],['tijdsindeling','de','schedule'],
  ['openingsuur','het','opening hour'],['spreekuur','het','surgery hours'],['kantoortijd','de','office hours'],['bereikbaarheid','de','availability'],['tijdrovend','','time-consuming'],
];
const POOL_5 = [ // De tijd
  ['uurwijzer','de','hour hand'],['minutenwijzer','de','minute hand'],
  ['microseconde','de','microsecond'],['picoseconde','de','picosecond'],['tijdwaarneming','de','time observation'],['tijdsregistratie','de','time registration'],
  ['seconde','de','second'],['minuut','de','minute'],['uur','het','hour'],['kwartier','het','quarter'],['halfuur','het','half hour'],
  ['ochtend','de','morning'],['middag','de','afternoon'],['avond','de','evening'],['nacht','de','night'],['middernacht','de','midnight'],
  ['maandag','de','Monday'],['dinsdag','de','Tuesday'],['woensdag','de','Wednesday'],['donderdag','de','Thursday'],['vrijdag','de','Friday'],
  ['zaterdag','de','Saturday'],['zondag','de','Sunday'],['weekend','het','weekend'],['weekdag','de','weekday'],['vakantie','de','holiday'],
  ['januari','de','January'],['februari','de','February'],['maart','de','March'],['april','de','April'],['mei','de','May'],
  ['juni','de','June'],['juli','de','July'],['augustus','de','August'],['september','de','September'],['oktober','de','October'],
  ['november','de','November'],['december','de','December'],['seizoen','het','season'],['lente','de','spring'],['zomer','de','summer'],
  ['herfst','de','autumn'],['winter','de','winter'],['verleden','het','past'],['heden','het','present'],['toekomst','de','future'],
  ['afspraak','de','appointment'],['agenda','de','diary'],['kalender','de','calendar'],['tijd','de','time'],['datum','de','date'],
  ['verjaardag','de','birthday'],['feestdag','de','holiday'],['vroeg','','early'],['laat','','late'],['punctueel','','punctual'],
  ['te laat','',null],['op tijd','',null],['van tevoren','',null],['achter','','behind'],['voor','','before'],
  ['kwart','het','quarter'],['klok','de','clock'],['tijdsduur','de','duration'],['deadline','de','deadline'],['tijdstip','het','time'],
  ['openingsuren','de','opening hours'],['sluitingstijd','de','closing time'],['vertrektijd','de','departure time'],['aankomsttijd','de','arrival time'],
  ['eerder','','earlier'],['onlangs','','recently'],['tegenwoordig','','nowadays'],['decennium','het','decade'],['eeuw','de','century'],
  ['voormiddag','de','morning'],['namiddag','de','afternoon'],['daglicht','het','daylight'],['schemering','de','twilight'],['zonsopgang','de','sunrise'],
  ['zonsondergang','de','sunset'],['werkdag','de','workday'],['vrije dag','',null],['feestdag','de','public holiday'],['herdenkingsdag','de','memorial day'],
  ['schrikkeljaar','het','leap year'],['kwartaal','het','quarter'],['semester','het','semester'],['trimester','het','trimester'],['looptijd','de','term'],
  ['vervaldatum','de','expiry date'],['aanvang','de','start'],['einde','het','end'],['duur','de','duration'],['interval','het','interval'],
  ['pauze','de','break'],['onderbreking','de','interruption'],['vertraging','de','delay'],['wachtrij','de','queue'],['beurt','de','turn'],
  ['tijdzone','de','time zone'],['zomertijd','de','summer time'],['wintertijd','de','winter time'],['klokken vooruit','',null],['klokken achteruit','',null],
  ['minuut','de','minute'],['seconde','de','second'],['tijdseenheid','de','unit of time'],['tijdsaanduiding','de','time indication'],['tijdmeting','de','time measurement'],
  ['chronologisch','','chronological'],['synchroon','','synchronous'],['gelijktijdig','','simultaneous'],['achtereenvolgens','','successively'],['tegelijk','','at the same time'],
  ['tussentijd','de','interval'],['wachtijd','de','waiting time'],['reistijd','de','travel time'],['openingstijd','de','opening time'],['sluitingstijd','de','closing time'],
  ['werkuren','de','working hours'],['overuren','de','overtime'],['vrije uren','',null],['spreekuur','het','surgery hours'],['afspraaktijd','de','appointment time'],
  ['verlengen','',null],['verkorten','',null],['verschuiven','',null],['uitstellen','',null],  ['vervroegen','',null],['tijdsverschil','het','time difference'],['tijdzone','de','time zone'],['zomertijd','de','daylight saving time'],['wintertijd','de','standard time'],['klok','de','clock'],
  ['stopwatch','de','stopwatch'],['timer','de','timer'],['wekker','de','alarm clock'],['chronometer','de','stopwatch'],['tijdschema','het','schedule'],
  ['tijdrovend','','time-consuming'],['tijdelijk','','temporary'],['tijdloos','','timeless'],['stipt','','punctual'],  ['laat','','late'],['afspraakkalender','de','appointment calendar'],['beschikbaarheid','de','availability'],['agendapunten','de','agenda items'],['vergaderdatum','de','meeting date'],
  ['afspraaklocatie','de','appointment location'],['bevestigingsmail','de','confirmation email'],['herinneringsmail','de','reminder email'],  ['afzegging','de','cancellation'],['afspraakbevestiging','de','appointment confirmation'],['afspraakverzoek','het','appointment request'],['wachtlijst','de','waiting list'],
  ['inloopuur','het','drop-in hour'],['afspraaktijd','de','appointment time'],['afspraakduur','de','appointment duration'],['vervolgafspraak','de','follow-up appointment'],['kennismakingsgesprek','het','introductory meeting'],
];
const POOL_6 = [ // Afspreken
  ['afspraakherinnering','de','appointment reminder'],['afspraakformulier','het','appointment form'],['afspraakdatum','de','appointment date'],['afspraakuur','het','appointment hour'],['afspraakmoment','het','appointment moment'],['afspraakslot','het','appointment slot'],
  ['afspraakwijziging','de','appointment change'],['afspraakannulering','de','appointment cancellation'],['afspraakverplaatsing','de','appointment rescheduling'],
  ['afspraak','de','appointment'],['ontmoeting','de','meeting'],['date','de','date'],['feestje','het','party'],['verjaardagsfeest','het','birthday party'],
  ['uitnodiging','de','invitation'],['bevestiging','de','confirmation'],['annulering','de','cancellation'],['wijziging','de','change'],['verzetten','',null],
  ['café','het','café'],['restaurant','het','restaurant'],['bar','de','bar'],['park','het','park'],['bioscoop','de','cinema'],
  ['theater','het','theatre'],['museum','het','museum'],['concert','het','concert'],['tentoonstelling','de','exhibition'],['film','de','film'],
  ['entree','de','entrance'],['kaartje','het','ticket'],['reservering','de','reservation'],['tafel','de','table'],['plek','de','seat'],
  ['tijd','de','time'],['plaats','de','place'],['adres','het','address'],['route','de','route'],['afstand','de','distance'],
  ['samen','','together'],['alleen','','alone'],['met z\'n tweeën','',null],['gezelschap','het','company'],['gast','de','guest'],
  ['gastheer','de','host'],['gastvrouw','de','hostess'],['kennismaken','',null],['weerzien','het','reunion'],['afscheid','het','farewell'],
  ['begroeten','',null],['groet','de','greeting'],['hand geven','',null],['zoenen','',null],['knuffel','de','hug'],
  ['bericht','het','message'],['sms','de','text'],['whatsapp','de','WhatsApp'],['bellen','',null],['terugbellen','',null],
  ['afzeggen','',null],['doorgaan','',null],['verplaatsen','',null],['uitstellen','',null],['plannen','',null],
  ['agenda','de','diary'],['planning','de','schedule'],['beschikbaar','','available'],['vrij','','free'],['druk','','busy'],
  ['verjaardagsfeestje','het','birthday party'],['housewarming','de','housewarming'],['bruiloftsfeest','het','wedding party'],['reünie','de','reunion'],['netwerkborrel','de','networking drink'],
  ['kennismakingsgesprek','het','get-to-know conversation'],['afscheidsfeest','het','farewell party'],['jubileum','het','anniversary'],['promotie','de','promotion'],['sollicitatiegesprek','het','job interview'],
  ['wachtkamer','de','waiting room'],['inloopspreekuur','het','drop-in surgery'],['vooraf reserveren','',null],['annuleren','',null],['verzetten','',null],
  ['locatie','de','location'],['bereikbaarheid','de','accessibility'],  ['parkeerplaats','de','parking spot'],['ov-halte','de','public transport stop'],['loopafstand','de','walking distance'],
  ['afspraak maken','',null],['afzeggen','',null],['bevestigen','',null],['uitnodigen','',null],['annuleren','',null],
  ['ontmoetingspunt','het','meeting point'],['verzamelpunt','het','meeting point'],['richting','de','direction'],['routebeschrijving','de','directions'],['postcode','de','postal code'],
  ['huisnummer','het','house number'],['landmark','het','landmark'],['herkenningspunt','het','landmark'],['afstand','de','distance'],  ['reistijd','de','travel time'],['afspraakbevestiging','de','appointment confirmation'],['herinnering','de','reminder'],['uitnodigingskaart','de','invitation card'],['gastlijst','de','guest list'],
  ['dresscode','de','dress code'],['catering','de','catering'],['feestzaal','de','party venue'],['vergaderruimte','de','meeting room'],['reserveringssysteem','het','booking system'],
];
const POOL_7 = [ // Eten en drinken
  ['maaltijd','de','meal'],['gerecht','het','dish'],['recept','het','recipe'],['ingrediënt','het','ingredient'],['portie','de','portion'],
  ['voedsel','het','food'],['eten','het','food'],['drinken','het','drink'],['drank','de','drink'],['drankje','het','drink'],
  ['vlees','het','meat'],['kip','de','chicken'],['vis','de','fish'],['vegetarisch','',null],['veganistisch','',null],
  ['groente','de','vegetable'],['fruit','het','fruit'],['salade','de','salad'],['soep','de','soup'],['saus','de','sauce'],
  ['rijst','de','rice'],['pasta','de','pasta'],['aardappel','de','potato'],['brood','het','bread'],['stokbrood','het','baguette'],
  ['kaas','de','cheese'],['ei','het','egg'],['yoghurt','de','yoghurt'],['kwark','de','quark'],['honing','de','honey'],
  ['jam','de','jam'],['pindakaas','de','peanut butter'],['chocolade','de','chocolate'],['koekje','het','biscuit'],['taart','de','cake'],
  ['snoep','het','sweets'],['ijs','het','ice cream'],['chips','de','crisps'],['noten','de','nuts'],['olijven','de','olives'],
  ['bier','het','beer'],['wijn','de','wine'],['frisdrank','de','soft drink'],['mineraalwater','het','mineral water'],['kruidenthee','de','herbal tea'],
  ['bestek','het','cutlery'],['mes','het','knife'],['vork','de','fork'],['lepel','de','spoon'],['bord','het','plate'],
  ['glas','het','glass'],['mok','de','mug'],['kopje','het','cup'],['servet','het','napkin'],['tafelkleed','het','tablecloth'],
  ['smakelijk','','enjoy your meal'],['proost','','cheers'],['dorst','de','thirst'],['honger','de','hunger'],['vol','','full'],
  ['lekker','','tasty'],['vies','','disgusting'],['zoet','','sweet'],['zout','','salty'],['zuur','','sour'],
  ['voedingswaarde','de','nutritional value'],['calorieën','de','calories'],['koolhydraten','de','carbohydrates'],['eiwitten','de','proteins'],['vetten','de','fats'],
  ['vezels','de','fibre'],['allergenen','de','allergens'],['glutenvrij','','gluten-free'],['lactosevrij','','lactose-free'],['suikervrij','','sugar-free'],
  ['light','','light'],['volvet','','full-fat'],['magere','',null],['halfvol','','semi-skimmed'],['volle melk','',null],
  ['vers sap','',null],['smoothie','de','smoothie'],['milkshake','de','milkshake'],['koffie verkeerd','',null],['espresso','de','espresso'],
  ['cappuccino','de','cappuccino'],['latte','de','latte'],['theebuiltje','het','tea bag'],['kruideninfusie','de','herbal infusion'],  ['waterkoker','de','kettle'],
  ['maag','de','stomach'],['eetlust','de','appetite'],['verzadigd','','satiated'],['hongerig','','hungry'],['dorstig','','thirsty'],
  ['voedingsstoffen','de','nutrients'],['mineralen','de','minerals'],['vitamine','de','vitamin'],['gezonde voeding','',null],  ['ongezond','','unhealthy'],['smaak','de','taste'],['reuk','de','smell'],['textuur','de','texture'],['kruiding','de','seasoning'],['kruiden','de','herbs'],
];
const POOL_8 = [ // Boodschappen
  ['supermarkt','de','supermarket'],['winkel','de','shop'],['markt','de','market'],['bakker','de','bakery'],['slager','de','butcher'],
  ['groenteboer','de','greengrocer'],['kassa','de','checkout'],['winkelwagen','de','shopping trolley'],['mandje','het','basket'],['boodschappenlijst','de','shopping list'],
  ['prijs','de','price'],['korting','de','discount'],['aanbieding','de','special offer'],['bon','de','voucher'],['kassabon','de','receipt'],
  ['pinpas','de','debit card'],['contant','','cash'],['pinnen','',null],['betalen','',null],['wisselgeld','het','change'],
  ['verpakking','de','packaging'],['fles','de','bottle'],['pak','het','pack'],['doos','de','box'],['zak','de','bag'],
  ['liter','de','litre'],['kilo','het','kilo'],['gram','het','gram'],['stuk','het','piece'],['dozijn','het','dozen'],
  ['verse','',null],['vers','','fresh'],['houdbaar','','durable'],['houdbaarheidsdatum','de','best-before date'],['biologisch','','organic'],
  ['melk','de','milk'],['boter','de','butter'],['eieren','de','eggs'],['vla','de','custard'],['kwark','de','quark'],
  ['sla','de','lettuce'],['tomaat','de','tomato'],['komkommer','de','cucumber'],['wortel','de','carrot'],['ui','de','onion'],
  ['appel','de','apple'],['banaan','de','banana'],['sinaasappel','de','orange'],['druif','de','grape'],['aardbei','de','strawberry'],
  ['vleeswaren','de','cold cuts'],['worst','de','sausage'],['ham','de','ham'],['filet','de','fillet'],['gehakt','het','minced meat'],
  ['diepvries','de','freezer'],['koelkast','de','fridge'],['schap','het','shelf'],  ['vak','het','section'],['assortiment','het','assortment'],
  ['versafdeling','de','fresh section'],['vleesafdeling','de','meat counter'],['zuivelafdeling','de','dairy section'],['broodafdeling','de','bakery section'],
  ['diepvriesvak','het','freezer compartment'],['schap','het','shelf'],['aanbieding','de','special offer'],['tweede gratis','',null],['statiegeld','het','deposit'],
  ['barcode','de','barcode'],['streepjescode','de','barcode'],['kassabon','de','receipt'],['wisselgeld','het','change'],['pinbetaling','de','card payment'],
];
const POOL_9 = [ // Winkelen
  ['verkoopmedewerker','de','sales assistant'],['winkelmedewerker','de','shop assistant'],
  ['verkoopruimte','de','sales space'],['koopjesafdeling','de','bargain section'],['winkelvloer','de','shop floor'],
  ['winkelcentrum','het','shopping centre'],['winkelstraat','de','shopping street'],['etalage','de','shop window'],['uitverkoop','de','sale'],
  ['kledingwinkel','de','clothing shop'],['schoenwinkel','de','shoe shop'],['boekwinkel','de','bookshop'],['speelgoedwinkel','de','toy shop'],
  ['maat','de','size'],['kleur','de','colour'],['stijl','de','style'],['materiaal','het','material'],['passen','',null],
  ['paskamer','de','fitting room'],['te groot','',null],['te klein','',null],['passen','',null],['ruilen','',null],['retourneren','',null],
  ['kleding','de','clothes'],['jurk','de','dress'],['blouse','de','blouse'],['overhemd','het','shirt'],['spijkerbroek','de','jeans'],
  ['jas','de','coat'],['trui','de','sweater'],['sjaal','de','scarf'],['handschoenen','de','gloves'],['hoed','de','hat'],
  ['schoenen','de','shoes'],['sandaal','de','sandal'],['slipper','de','slipper'],['sportshirt','het','sports shirt'],['korte broek','de','shorts'],
  ['ondergoed','het','underwear'],['pyjama','de','pyjamas'],['badpak','het','swimsuit'],['regenjas','de','raincoat'],['paraplu','de','umbrella'],
  ['tas','de','bag'],['handtas','de','handbag'],['rugzak','de','backpack'],['portemonnee','de','wallet'],['portefeuille','de','wallet'],
  ['sieraden','de','jewellery'],['ring','de','ring'],['ketting','de','necklace'],['armband','de','bracelet'],['oorbellen','de','earrings'],
  ['horloge','het','watch'],['bril','de','glasses'],['zonnebril','de','sunglasses'],['parfum','het','perfume'],['cosmetica','de','cosmetics'],
  ['kopen','',null],['verkopen','',null],['betalen','',null],['duur','','expensive'],['goedkoop','','cheap'],
  ['korting','de','discount'],['prijs','de','price'],['te duur','',null],
  ['collectie','de','collection'],['nieuwste mode','',null],['outlet','de','outlet'],['tweedehandswinkel','de','second-hand shop'],
  ['webshop','de','web shop'],['online bestellen','',null],['thuisbezorgd','',null],['retourneren','',null],['ruilen','',null],
  ['cadeauverpakking','de','gift wrapping'],['kassabon','de','receipt'],['garantie','de','warranty'],['klantenservice','de','customer service'],  ['winkelier','de','shopkeeper'],
  ['maatje','het','size'],['maattabel','de','size chart'],['kledingmaat','de','clothing size'],['schoenmaat','de','shoe size'],['passen','',null],
  ['kassa','de','checkout'],['wisselgeld','het','change'],['kortingsbon','de','discount voucher'],['actie','de','promotion'],['uitverkoop','de','sale'],
  ['nieuwe collectie','',null],['wintercollectie','de','winter collection'],['zomercollectie','de','summer collection'],['basiscollectie','de','basic collection'],  ['designer','de','designer'],['kledingstuk','het','garment'],['etalage','de','shop window'],['uitverkoop','de','sale'],['collectie','de','collection'],
  ['winkelwagen','de','shopping cart'],['winkelmandje','het','shopping basket'],['kassamedewerker','de','cashier'],['verkoopster','de','saleswoman'],['verkoper','de','salesperson'],
  ['winkelketen','de','chain store'],['filiaal','het','branch'],['hoofdwinkel','de','flagship store'],['showroom','de','showroom'],['toonzaal','de','showroom'],['accessoire','het','accessory'],['sieraden','de','jewellery'],['horloge','het','watch'],['riem','de','belt'],
  ['schoenwinkel','de','shoe shop'],['modebewust','','fashion-conscious'],['kledingkast','de','wardrobe'],['winkelstraat','de','shopping street'],['winkelcentrum','het','shopping centre'],
  ['verkoopvloer','de','shop floor'],['koopjeshoek','de','bargain corner'],['nieuw binnen','',null],['laatste stuks','',null],['op=op','',null],
];
const POOL_10 = [ // Gezondheid
  ['gezondheid','de','health'],['ziekte','de','illness'],['pijn','de','pain'],['koorts','de','fever'],['hoofdpijn','de','headache'],
  ['buikpijn','de','stomach ache'],['keelpijn','de','sore throat'],['oorpijn','de','earache'],['rugpijn','de','backache'],['kiespijn','de','toothache'],
  ['verkoudheid','de','cold'],['griep','de','flu'],['hoest','de','cough'],['niezen','',null],['snot','het','snot'],
  ['allergie','de','allergy'],['astma','de','asthma'],['diabetes','de','diabetes'],['bloed','het','blood'],['bloeddruk','de','blood pressure'],
  ['arts','de','doctor'],['huisarts','de','GP'],['specialist','de','specialist'],['tandarts','de','dentist'],['apotheker','de','pharmacist'],
  ['ziekenhuis','het','hospital'],['apotheek','de','pharmacy'],['spreekuur','het','surgery hours'],['afspraak','de','appointment'],['recept','het','prescription'],
  ['medicijn','het','medicine'],['pillen','de','pills'],['tablet','de','tablet'],['druppels','de','drops'],['zetpil','de','suppository'],
  ['paracetamol','de','paracetamol'],['antibiotica','de','antibiotics'],['vitamines','de','vitamins'],['inenting','de','vaccination'],['prik','de','injection'],
  ['verband','het','bandage'],['pleister','de','plaster'],['thermometer','de','thermometer'],['weegschaal','de','scales'],['spuit','de','syringe'],
  ['operatie','de','operation'],['narcose','de','anaesthesia'],['herstel','het','recovery'],['revalidatie','de','rehabilitation'],['fysiotherapie','de','physiotherapy'],
  ['ziek','','ill'],['gezond','','healthy'],['beter','','better'],['ziek melden','',null],['ziekteverlof','het','sick leave'],
  ['rust','de','rest'],['slapen','',null],['uitzieken','',null],['voorzichtig','','careful'],['preventie','de','prevention'],
  ['bewegen','',null],['sporten','',null],['dieet','het','diet'],['afvallen','',null],['aankomen','',null],
  ['ziekteverzekering','de','health insurance'],['eigen risico','',null],['verwijzing','de','referral'],['huisartsenpost','de','out-of-hours GP'],['spoedeisende hulp','',null],
  ['bloedonderzoek','het','blood test'],['urineonderzoek','het','urine test'],['röntgenfoto','de','X-ray'],['echo','de','ultrasound'],['scan','de','scan'],
  ['behandeling','de','treatment'],['therapie','de','therapy'],['recept','het','prescription'],['dosering','de','dosage'],['bijwerking','de','side effect'],
  ['ziekenhuisopname','de','hospital admission'],['ontslag','het','discharge'],['controle','de','check-up'],['follow-up','de','follow-up'],['herstel','het','recovery'],
];

const POOLS = {
  1: POOL_1, 2: POOL_2, 3: POOL_3, 4: POOL_4, 5: POOL_5,
  6: POOL_6, 7: POOL_7, 8: POOL_8, 9: POOL_9, 10: POOL_10
};

const TARGET_PER_THEME = 200;

function addVocab() {
  const klimop = JSON.parse(fs.readFileSync(KLIMOP_PATH, 'utf8'));
  const existingNl = new Set(klimop.vocab.map(i => i.nl.toLowerCase().trim()));
  const existingEn = new Set(klimop.vocab.map(i => i.en && i.en.toLowerCase().trim()).filter(Boolean));

  const counts = {};
  klimop.vocab.forEach(i => { counts[i.theme] = (counts[i.theme] || 0) + 1; });
  const startIndex = {};
  for (let t = 1; t <= 10; t++) {
    const last = klimop.vocab.filter(v => v.theme === t).pop();
    startIndex[t] = last ? parseInt(last.id.split('_')[1], 10) + 1 : 0;
  }

  const newEntries = [];
  for (let theme = 1; theme <= 10; theme++) {
    const pool = POOLS[theme];
    const need = Math.max(0, TARGET_PER_THEME - (counts[theme] || 0));
    if (need === 0) continue;
    const start = startIndex[theme];
    let added = 0;
    for (let i = 0; added < need && i < pool.length; i++) {
      const [nl, article, en] = pool[i];
      if (!en) continue; // skip placeholders
      const nlKey = nl.toLowerCase().trim();
      const enKey = (en || '').toLowerCase().trim();
      if (existingNl.has(nlKey) || existingEn.has(enKey)) continue;
      const id = `t${String(theme).padStart(2,'0')}_${String(start + added).padStart(4,'0')}`;
      newEntries.push({
        id, theme,
        nl: nl.trim(),
        article: article || null,
        en: en.trim(),
        tags: []
      });
      existingNl.add(nlKey);
      existingEn.add(enKey);
      added++;
    }
    if (added < need) console.warn(`Theme ${theme}: only ${added}/${need} added (pool exhausted or duplicates)`);
  }

  klimop.vocab.push(...newEntries);
  fs.writeFileSync(KLIMOP_PATH, JSON.stringify(klimop, null, 2), 'utf8');
  console.log('Klimop: added', newEntries.length, 'vocab entries');

  const finalCounts = {};
  klimop.vocab.forEach(i => { finalCounts[i.theme] = (finalCounts[i.theme]||0)+1; });
  console.log('Counts per theme after:', finalCounts);
  return { newEntries, counts: finalCounts };
}

// --- Verbs: exclude nouns (nl single word ending -en but not verb) ---
const EXCLUDE_VERB_NOUNS = new Set([
  'kinderen','vrienden','brieven','schoenen','boodschappen','bloemen','jongen','zeven','negen','tien',
  'Polen','planten','ramen','tanden','haren','kleren','pensioen','tentamen','examen','miljoen',
  'studiepunten','vakantiedagen','ziektedagen','zonnepanelen','arbeidsvoorwaarden','ontwikkelpunten','oefententamen','medeleven','netwerken'
]);

function isSingleWordEndingEn(nl) {
  if (!nl || typeof nl !== 'string') return false;
  const t = nl.trim();
  return /^[a-zà-ÿ]+en$/i.test(t) && !t.includes(' ');
}

function collectVerbs() {
  const klimop = JSON.parse(fs.readFileSync(KLIMOP_PATH, 'utf8'));
  const windmee = JSON.parse(fs.readFileSync(WINDMEE_PATH, 'utf8'));
  const seen = new Map(); // infinitive -> { nl, en }
  function add(vocab) {
    vocab.forEach(item => {
      const en = item.en;
      if (!en || !en.startsWith('to ')) return;
      const nl = item.nl && item.nl.trim();
      if (!isSingleWordEndingEn(nl)) return;
      if (EXCLUDE_VERB_NOUNS.has(nl.toLowerCase())) return;
      const inf = nl.toLowerCase();
      if (!seen.has(inf)) seen.set(inf, { nl, en });
    });
  }
  add(klimop.vocab);
  add(windmee.vocab);
  return seen;
}

// Dutch conjugation helpers (stem = infinitive minus -en)
function stem(infinitive) {
  const s = infinitive.toLowerCase();
  if (s.endsWith('en')) return s.slice(0, -2);
  return s;
}
function stemConsonantDoubling(stemStr) {
  const v = 'aeiou';
  const last = stemStr[stemStr.length - 1];
  const prev = stemStr[stemStr.length - 2];
  if (last && !v.includes(last) && prev && v.includes(prev) && stemStr.length <= 4) return stemStr + last;
  return stemStr;
}
// Weak: stem+t for 2/3sg, stem for ik; past stem+te/ten; perfect ge+stem+d/t
function weakConjugate(infinitive) {
  let s = stem(infinitive);
  const e = s[s.length - 1];
  const voiceless = 'ptkfsch';
  const needsT = e === 't' || e === 'd' || voiceless.includes(e);
  const pastSuffix = needsT ? 'te' : 'de';
  const pastPlural = needsT ? 'ten' : 'den';
  const perfectSuffix = needsT ? 't' : 'd';
  s = stemConsonantDoubling(s);
  const ik = s;
  const sg = s + (s.endsWith('t') || s.endsWith('d') ? '' : (s.match(/[aeiou]$/) ? 't' : 't'));
  const hij = (s.length >= 2 && s.endsWith('v')) ? s.slice(0,-1)+'ft' : (s.endsWith('z') ? s+'t' : sg);
  return {
    present: { ik, jij: hij, hij, wij: infinitive, jullie: infinitive, zij: infinitive },
    past: { singular: s + pastSuffix, plural: s + pastPlural },
    perfect: 'ge' + s + perfectSuffix + 'en'
  };
}

// Strong/irregular table (infinitive -> past singular, past plural, perfect)
const IRREGULAR = {
  zijn: { pastS: 'was', pastP: 'waren', perfect: 'geweest', aux: 'zijn' },
  hebben: { pastS: 'had', pastP: 'hadden', perfect: 'gehad', aux: 'hebben' },
  gaan: { pastS: 'ging', pastP: 'gingen', perfect: 'gegaan', aux: 'zijn' },
  komen: { pastS: 'kwam', pastP: 'kwamen', perfect: 'gekomen', aux: 'zijn' },
  doen: { pastS: 'deed', pastP: 'deden', perfect: 'gedaan', aux: 'hebben' },
  zien: { pastS: 'zag', pastP: 'zagen', perfect: 'gezien', aux: 'hebben' },
  zeggen: { pastS: 'zei', pastP: 'zeiden', perfect: 'gezegd', aux: 'hebben' },
  staan: { pastS: 'stond', pastP: 'stonden', perfect: 'gestaan', aux: 'hebben' },
  slaan: { pastS: 'sloeg', pastP: 'sloegen', perfect: 'geslagen', aux: 'hebben' },
  eten: { pastS: 'at', pastP: 'aten', perfect: 'gegeten', aux: 'hebben' },
  drinken: { pastS: 'dronk', pastP: 'dronken', perfect: 'gedronken', aux: 'hebben' },
  slapen: { pastS: 'sliep', pastP: 'sliepen', perfect: 'geslapen', aux: 'hebben' },
  lezen: { pastS: 'las', pastP: 'lazen', perfect: 'gelezen', aux: 'hebben' },
  schrijven: { pastS: 'schreef', pastP: 'schreven', perfect: 'geschreven', aux: 'hebben' },
  spreken: { pastS: 'sprak', pastP: 'spraken', perfect: 'gesproken', aux: 'hebben' },
  denken: { pastS: 'dacht', pastP: 'dachten', perfect: 'gedacht', aux: 'hebben' },
  kopen: { pastS: 'kocht', pastP: 'kochten', perfect: 'gekocht', aux: 'hebben' },
  lopen: { pastS: 'liep', pastP: 'liepen', perfect: 'gelopen', aux: 'hebben' },
  zitten: { pastS: 'zat', pastP: 'zaten', perfect: 'gezeten', aux: 'hebben' },
  zingen: { pastS: 'zong', pastP: 'zongen', perfect: 'gezongen', aux: 'hebben' },
  vragen: { pastS: 'vroeg', pastP: 'vroegen', perfect: 'gevraagd', aux: 'hebben' },
  geven: { pastS: 'gaf', pastP: 'gaven', perfect: 'gegeven', aux: 'hebben' },
  nemen: { pastS: 'nam', pastP: 'namen', perfect: 'genomen', aux: 'hebben' },
  krijgen: { pastS: 'kreeg', pastP: 'kregen', perfect: 'gekregen', aux: 'hebben' },
  vinden: { pastS: 'vond', pastP: 'vonden', perfect: 'gevonden', aux: 'hebben' },
  helpen: { pastS: 'hielp', pastP: 'hielpen', perfect: 'geholpen', aux: 'hebben' },
  houden: { pastS: 'hield', pastP: 'hielden', perfect: 'gehouden', aux: 'hebben' },
  rijden: { pastS: 'reed', pastP: 'reden', perfect: 'gereden', aux: 'hebben' },
  bezoeken: { pastS: 'bezocht', pastP: 'bezochten', perfect: 'bezocht', aux: 'hebben' },
  ontmoeten: { pastS: 'ontmoette', pastP: 'ontmoetten', perfect: 'ontmoet', aux: 'hebben' },
  strijken: { pastS: 'streek', pastP: 'streken', perfect: 'gestreken', aux: 'hebben' },
  beginnen: { pastS: 'begon', pastP: 'begonnen', perfect: 'begonnen', aux: 'hebben' },
  zwemmen: { pastS: 'zwom', pastP: 'zwommen', perfect: 'gezwommen', aux: 'hebben' },
  breken: { pastS: 'brak', pastP: 'braken', perfect: 'gebroken', aux: 'hebben' },
  vergeten: { pastS: 'vergat', pastP: 'vergaten', perfect: 'vergeten', aux: 'hebben' },
  liegen: { pastS: 'loog', pastP: 'logen', perfect: 'gelogen', aux: 'hebben' },
  kiezen: { pastS: 'koos', pastP: 'kozen', perfect: 'gekozen', aux: 'hebben' },
  vriezen: { pastS: 'vroor', pastP: 'vroren', perfect: 'gevroren', aux: 'hebben' },
  bieden: { pastS: 'bood', pastP: 'boden', perfect: 'geboden', aux: 'hebben' },
  genieten: { pastS: 'genoot', pastP: 'genoten', perfect: 'genoten', aux: 'hebben' },
  vallen: { pastS: 'viel', pastP: 'vielen', perfect: 'gevallen', aux: 'zijn' },
  sterven: { pastS: 'stierf', pastP: 'stierven', perfect: 'gestorven', aux: 'zijn' },
  blijven: { pastS: 'bleef', pastP: 'bleven', perfect: 'gebleven', aux: 'zijn' },
  schieten: { pastS: 'schoot', pastP: 'schoten', perfect: 'geschoten', aux: 'hebben' },
  gieten: { pastS: 'goot', pastP: 'goten', perfect: 'gegoten', aux: 'hebben' },
  spelen: { pastS: 'speelde', pastP: 'speelden', perfect: 'gespeeld', aux: 'hebben' },
  vertellen: { pastS: 'vertelde', pastP: 'vertelden', perfect: 'verteld', aux: 'hebben' },
};

// Present tense for strong verbs (often stem + t, with vowel change for some)
function presentFromStem(inf, stemStr) {
  const special = {
    eten: 'eet', slapen: 'slaap', lezen: 'lees', geven: 'geef', nemen: 'neem', zien: 'zie',
    hebben: 'heb', zijn: 'ben', gaan: 'ga', komen: 'kom', doen: 'doe', zeggen: 'zeg',
    staan: 'sta', lopen: 'loop', zitten: 'zit', houden: 'houd', vinden: 'vind', blijven: 'blijf',
    rijden: 'rijd', krijgen: 'krijg', kiezen: 'kies', bieden: 'bied', genieten: 'geniet',
    vallen: 'val', sterven: 'sterf', schieten: 'schiet', gieten: 'giet', liegen: 'lieg',
    beginnen: 'begin', zwemmen: 'zwem', breken: 'breek', vergeten: 'vergeet', vriezen: 'vries',
    ontmoeten: 'ontmoet', bezoeken: 'bezoek', strijken: 'strijk'
  };
  const ik = special[inf] || (stemStr + (stemStr.endsWith('t') || stemStr.endsWith('d') ? '' : ''));
  const t = (ik.endsWith('t') || ik.endsWith('d') || 'ptkfsch'.includes(ik[ik.length-1])) ? '' : 't';
  const hij = ik === 'doe' ? 'doet' : ik === 'ga' ? 'gaat' : ik === 'sta' ? 'staat' : ik + (ik === 'blijf' ? 't' : t);
  return { ik, jij: hij, hij, wij: inf, jullie: inf, zij: inf };
}

function buildVerbEntry(inf, en, type, aux, present, past, perfect) {
  const id = 'v_' + inf.replace(/\s/g, '_');
  return { id, infinitive: inf, en, type, auxiliary: aux, present, past, perfect };
}

function addVerbs() {
  const verbs = collectVerbs();
  const grammar = JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf8'));
  const existingInf = new Set(grammar.verbs.map(v => v.infinitive.toLowerCase()));

  const skipped = [];
  const added = [];

  for (const [inf, { en }] of verbs) {
    if (existingInf.has(inf)) continue;

    // Skip compound / no simple conjugation
    if (['kennismaken', 'videobellen', 'boodschappen doen', 'gedag zeggen', 'tanden poetsen', 'haren kammen', 'zich aankleden', 'televisie kijken', 'internetten', 'huiswerk maken', 'muziek luisteren', 'fitnessen', 'hardlopen', 'praten over', 'moeten', 'mogen', 'willen', 'kunnen', 'ramen schoonmaken', 'stofzuigen', 'afwassen', 'kleren wassen', 'planten', 'wakker worden', 'uitrusten', 'haar wassen', 'gezicht wassen', 'kleren aandoen', 'bed opmaken', 'vuilnis buiten zetten', 'post ophalen', 'krant lezen', 'hond uitlaten', 'thee drinken', 'lunch klaarmaken', 'een toets maken', 'naar bed gaan', 'yoga doen', 'muziek maken', 'voetbal spelen', 'gitaar spelen', 'koffie zetten', 'auto rijden', 'een bad nemen', 'de was doen', 'zich opmaken', 'zich scheren', 'brood roosteren', 'een ei bakken', 'een taart bakken', 'soep koken', 'de wekker zetten', 'de auto wassen', 'in de tuin werken', 'de ramen lappen', 'de hond uitlaten', 'de vuilniszakken buiten zetten', 'stof afnemen', 'ramen zemen', 'planten water geven', 'krant lezen', 'muziek luisteren', 'televisie kijken', 'een bericht achterlaten', 'terugbellen', 'een kaartje sturen', 'opbellen', 'een afspraak maken', 'een bericht sturen', 'samen zijn', 'afspreken met', 'uitnodigen voor', 'kaarsjes uitblazen', 'stage lopen', 'cijfer geven', 'reageren op', 'sollicitatiegesprek voorbereiden', 'vragen stellen', 'deadlines halen', 'kwaliteit leveren', 'feedback geven', 'feedback ontvangen', 'ontslag nemen'].includes(inf)) {
      skipped.push({ inf, reason: 'compound or no simple conjugation' });
      continue;
    }

    let entry;
    const ir = IRREGULAR[inf];
    if (ir) {
      const stemStr = stem(inf);
      entry = buildVerbEntry(inf, en, 'irregular', ir.aux, presentFromStem(inf, stemStr),
        { singular: ir.pastS, plural: ir.pastP }, ir.perfect);
    } else {
      // Separable?
      const parts = inf.match(/^(aan|af|op|uit|mee|in|door|om|terug|voor|na|bij|toe)(.+)$/);
      if (parts) {
        const [, prefix, rest] = parts;
        const base = rest; // e.g. ruimen
        const conj = weakConjugate(base);
        const sep = (form) => form.split(' ').map((w, i) => i === 0 ? w : prefix + ' ' + w).join(' ').replace(prefix + ' ', '') || (base + ' ' + prefix);
        const space = ' ';
        entry = {
          id: 'v_' + inf.replace(/\s/g, '_'),
          infinitive: inf,
          en,
          type: 'weak',
          auxiliary: 'hebben',
          present: {
            ik: base.replace(/en$/, '') + space + prefix,
            jij: base.replace(/en$/, 't') + space + prefix,
            hij: base.replace(/en$/, 't') + space + prefix,
            wij: base + space + prefix,
            jullie: base + space + prefix,
            zij: base + space + prefix
          },
          past: { singular: conj.past.singular + space + prefix, plural: conj.past.plural + space + prefix },
          perfect: prefix + 'ge' + stem(base) + (base.match(/[tdpkfsch]$/) ? 't' : 'd') + 'en'
        };
        // Fix common separable
        if (inf === 'opruimen') {
          entry.present = { ik: 'ruim op', jij: 'ruimt op', hij: 'ruimt op', wij: 'ruimen op', jullie: 'ruimen op', zij: 'ruimen op' };
          entry.past = { singular: 'ruimde op', plural: 'ruimden op' };
          entry.perfect = 'opgeruimd';
        } else if (inf === 'uitnodigen') {
          entry.present = { ik: 'nodig uit', jij: 'nodigt uit', hij: 'nodigt uit', wij: 'nodigen uit', jullie: 'nodigen uit', zij: 'nodigen uit' };
          entry.past = { singular: 'nodigde uit', plural: 'nodigden uit' };
          entry.perfect = 'uitgenodigd';
        }
      } else {
        const conj = weakConjugate(inf);
        entry = buildVerbEntry(inf, en, 'weak', 'hebben', conj.present, conj.past, conj.perfect);
      }
    }

    grammar.verbs.push(entry);
    existingInf.add(inf);
    added.push(inf);
  }

  fs.writeFileSync(GRAMMAR_PATH, JSON.stringify(grammar, null, 2), 'utf8');
  console.log('Grammar: added', added.length, 'verbs');
  if (skipped.length) console.log('Skipped:', skipped);
  return { added: added.length, skipped };
}

// Run
addVocab();
addVerbs();

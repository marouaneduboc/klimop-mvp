import json

themes = [
    (1, "Relaties"),
    (2, "Mijn buurt"),
    (3, "Vrije tijd"),
    (4, "Vervoer"),
    (5, "Vakantie"),
    (6, "Natuur"),
    (7, "Gezondheid"),
    (8, "Veiligheid"),
    (9, "Onderwijs organisatie"),
    (10, "Onderwijs inhoud"),
    (11, "Stage"),
    (12, "Werk organisatie"),
    (13, "Werk inhoud"),
    (14, "Media"),
    (15, "Geschiedenis"),
    (16, "De samenleving")
]

vocab_data = {
    1: [
        ("de relatie", "the relationship"), ("het gevoel", "the feeling"),
        ("wensen", "to wish"), ("het advies", "the advice"),
        ("afspreken", "to meet up / arrange"), ("zich excuseren", "to apologize"),
        ("het praatje", "the chat / small talk"), ("verliefd", "in love"),
        ("de ruzie", "the argument"), ("blij", "happy"),
        ("verdrietig", "sad"), ("eerlijk", "honest"),
        ("missen", "to miss"), ("de vriendschap", "the friendship"),
        ("de partner", "the partner")
    ],
    2: [
        ("de inrichting", "the furnishing / interior"), ("het huishouden", "the household"),
        ("de stofzuiger", "the vacuum cleaner"), ("de wasmachine", "the washing machine"),
        ("de buurman", "the male neighbor"), ("de buurvrouw", "the female neighbor"),
        ("schoonmaken", "to clean"), ("uitleggen", "to explain"),
        ("overtuigen", "to convince"), ("beschrijven", "to describe"),
        ("het nieuws", "the news"), ("gezellig", "cozy / sociable"),
        ("de rommel", "the mess"), ("opruimen", "to tidy up"),
        ("lenen", "to borrow")
    ],
    3: [
        ("de hobby", "the hobby"), ("de voorkeur", "the preference"),
        ("vragen", "to ask"), ("vertellen", "to tell"),
        ("het uitje", "the outing / trip"), ("organiseren", "to organize"),
        ("het weekend", "the weekend"), ("vrij", "free"),
        ("het museum", "the museum"), ("de bioscoop", "the cinema"),
        ("wandelen", "to walk"), ("ontspannen", "to relax"),
        ("de sport", "the sport"), ("voetballen", "to play soccer"),
        ("leuk", "fun / nice")
    ],
    4: [
        ("het verkeer", "the traffic"), ("het ongeluk", "the accident"),
        ("de veiligheid", "the safety"), ("de weg wijzen", "to show the way"),
        ("de instructie", "the instruction"), ("deelnemen", "to participate"),
        ("het kruispunt", "the intersection"), ("rechtdoor", "straight ahead"),
        ("linksaf", "turn left"), ("rechtsaf", "turn right"),
        ("het stoplicht", "the traffic light"), ("snel", "fast"),
        ("langzaam", "slow"), ("gevaarlijk", "dangerous"),
        ("waarschuwen", "to warn")
    ],
    5: [
        ("de vakantie", "the vacation / holiday"), ("het strand", "the beach"),
        ("de koffer", "the suitcase"), ("pakken", "to pack"),
        ("klagen", "to complain"), ("de pech", "the bad luck / breakdown"),
        ("hulp vragen", "to ask for help"), ("het huisje", "the cottage"),
        ("huren", "to rent"), ("kamperen", "to camp"),
        ("de tent", "the tent"), ("de zon", "the sun"),
        ("buitenland", "abroad"), ("reserveren", "to book / reserve"),
        ("boeken", "to book")
    ],
    6: [
        ("de natuur", "the nature"), ("de mening", "the opinion"),
        ("vergelijken", "to compare"), ("het afval", "the waste / rubbish"),
        ("scheiden", "to separate"), ("zuinig", "economical"),
        ("de energie", "the energy"), ("het dier", "the animal"),
        ("het bos", "the forest"), ("de zee", "the sea"),
        ("de boom", "the tree"), ("het milieu", "the environment"),
        ("beschermen", "to protect"), ("duurzaam", "sustainable"),
        ("groeien", "to grow")
    ],
    7: [
        ("de gezondheid", "the health"), ("de klacht", "the complaint"),
        ("de beweging", "the movement / exercise"), ("de gezondheidszorg", "the healthcare"),
        ("gezond", "healthy"), ("het geluk", "the happiness"),
        ("ziek", "sick"), ("de dokter", "the doctor"),
        ("het recept", "the prescription"), ("de pijn", "the pain"),
        ("het medicijn", "the medicine"), ("beter worden", "to get better"),
        ("bewegen", "to exercise / move"), ("de apotheek", "the pharmacy"),
        ("de afspraak", "the appointment")
    ],
    8: [
        ("de veiligheidsregel", "the safety rule"), ("de diefstal", "the theft"),
        ("melden", "to report"), ("de bekeuring", "the fine"),
        ("de werkplek", "the workplace"), ("onveilig", "unsafe"),
        ("voorzichtig", "careful"), ("de politie", "the police"),
        ("let op", "pay attention (command)"), ("de helm", "the helmet"),
        ("verboden", "forbidden"), ("verplicht", "mandatory"),
        ("het gevaar", "the danger"), ("voorkomen", "to prevent"),
        ("schade", "damage")
    ],
    9: [
        ("het onderwijs", "the education"), ("de organisatie", "the organization"),
        ("de workshop", "the workshop"), ("de opleiding", "the training / education"),
        ("informeren", "to inquire / inform"), ("schoolherinneringen", "school memories"),
        ("de student", "the student"), ("de docent", "the teacher"),
        ("de leraar", "the teacher (male)"), ("de school", "the school"),
        ("de universiteit", "the university"), ("het vak", "the subject"),
        ("het lokaal", "the classroom"), ("kiezen", "to choose"),
        ("studeren", "to study")
    ],
    10: [
        ("de inhoud", "the content"), ("adviseren", "to advise"),
        ("de schooltijd", "the school time"), ("het examen", "the exam"),
        ("doen", "to do / take (an exam)"), ("het cijfer", "the grade"),
        ("zakken", "to fail (exam)"), ("slagen", "to pass (exam)"),
        ("moeilijk", "difficult"), ("makkelijk", "easy"),
        ("leren", "to learn"), ("het huiswerk", "the homework"),
        ("begrijpen", "to understand"), ("de uitleg", "the explanation"),
        ("het diploma", "the diploma")
    ],
    11: [
        ("de stage", "the internship"), ("het beroep", "the profession"),
        ("de activiteit", "the activity"), ("het object", "the object"),
        ("de opdracht", "the assignment / task"), ("rapporteren", "to report"),
        ("aanvragen", "to apply for / request"), ("evalueren", "to evaluate"),
        ("plannen", "to plan"), ("de ervaring", "the experience"),
        ("het formulier", "the form"), ("de stagebegeleider", "the internship supervisor"),
        ("solliciteren", "to apply for a job"), ("ontwikkelen", "to develop"),
        ("het verslag", "the report")
    ],
    12: [
        ("de collega", "the colleague"), ("de leidinggevende", "the manager / supervisor"),
        ("het overleg", "the meeting"), ("het bedrijfsuitje", "the company outing"),
        ("de arbeidsvoorwaarden", "the terms of employment"), ("het vakantierooster", "the holiday schedule"),
        ("privé", "private"), ("het gesprek", "the conversation"),
        ("klagen", "to complain"), ("nieuw", "new"),
        ("het contract", "the contract"), ("het salaris", "the salary"),
        ("verdienen", "to earn"), ("overwerken", "to work overtime"),
        ("samenwerken", "to collaborate / work together")
    ],
    13: [
        ("verdelen", "to divide / distribute"), ("inwerken", "to onboard / train (staff)"),
        ("overdragen", "to hand over (work)"), ("de werkdag", "the workday"),
        ("het functioneringsgesprek", "the performance review"), ("de werkervaring", "the work experience"),
        ("de ambitie", "the ambition"), ("het werkrooster", "the work schedule"),
        ("helpen", "to help"), ("de taak", "the task"),
        ("het project", "the project"), ("verantwoordelijk", "responsible"),
        ("de vergadering", "the meeting"), ("de presentatie", "the presentation"),
        ("het doel", "the goal")
    ],
    14: [
        ("de media", "the media"), ("het interview", "the interview"),
        ("de weersvoorspelling", "the weather forecast"), ("telefoneren", "to phone / call"),
        ("de schermtijd", "the screen time"), ("social media", "social media"),
        ("de krant", "the newspaper"), ("het journaal", "the news broadcast"),
        ("kijken", "to watch"), ("lezen", "to read"),
        ("de telefoon", "the phone"), ("sturen", "to send (e.g. an email/text)"),
        ("het bericht", "the message"), ("de computer", "the computer"),
        ("online", "online")
    ],
    15: [
        ("de geschiedenis", "the history"), ("het verleden", "the past"),
        ("vroeger", "in the past / formally"), ("nu", "now"),
        ("de kindertijd", "the childhood"), ("de levensloop", "the course of life"),
        ("Nederlandse", "Dutch (adj)"), ("de emigratie", "the emigration"),
        ("de generatie", "the generation"), ("toen", "then / back when"),
        ("veranderen", "to change"), ("gebeuren", "to happen"),
        ("het verhaal", "the story"), ("de oorlog", "the war"),
        ("de vrede", "the peace")
    ],
    16: [
        ("de samenleving", "the society"), ("politiek", "political"),
        ("het thema", "the theme / topic"), ("de partij", "the party (political)"),
        ("perfect", "perfect"), ("het ding", "the thing"),
        ("tweedehands", "second-hand"), ("verkopen", "to sell"),
        ("kopen", "to buy"), ("typisch", "typical"),
        ("de evaluatie", "the evaluation"), ("de burger", "the citizen"),
        ("stemmen", "to vote"), ("de verkiezingen", "the elections"),
        ("de overheid", "the government")
    ]
}

out_vocab = []
for t_id, words in vocab_data.items():
    for w in words:
        nl = w[0]
        en = w[1]
        article = None
        if nl.startswith("de "):
            article = "de"
            nl = nl[3:]
        elif nl.startswith("het "):
            article = "het"
            nl = nl[4:]
        
        # ID gen e.g., b01_0000
        idx = len([v for v in out_vocab if v["theme"] == t_id])
        v_id = f"b{t_id:02d}_{idx:04d}"
        
        out_vocab.append({
            "id": v_id,
            "theme": t_id,
            "nl": nl,
            "article": article,
            "en": en,
            "tags": []
        })

out_data = {
    "version": "blinkuit-0.1",
    "themes": [{"id": t[0], "title": t[1]} for t in themes],
    "vocab": out_vocab
}

with open('/Users/fmjduboc/Documents/MeStuff/Nederlands/klimop-mvp/apps/web/public/content/blinkuit.json', 'w', encoding='utf-8') as f:
    json.dump(out_data, f, indent=2, ensure_ascii=False)

print("Generated blinkuit.json with", len(out_vocab), "words")

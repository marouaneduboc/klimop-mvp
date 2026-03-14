#!/usr/bin/env python3
import json

# Load the vocabulary data from subagent output
vocab_data = {
  "1": [
    {"nl": "achternaam", "en": "surname", "article": "de"},
    {"nl": "voornaam", "en": "first name", "article": "de"},
    {"nl": "in", "en": "in", "article": None},
    {"nl": "uit", "en": "from", "article": None},
    {"nl": "Engels", "en": "English", "article": None},
    {"nl": "Frans", "en": "French", "article": None},
    {"nl": "Duits", "en": "German", "article": None},
    {"nl": "Spaans", "en": "Spanish", "article": None},
    {"nl": "Italiaans", "en": "Italian", "article": None},
    {"nl": "Portugees", "en": "Portuguese", "article": None},
    {"nl": "Chinees", "en": "Chinese", "article": None},
    {"nl": "Japans", "en": "Japanese", "article": None},
    {"nl": "Arabisch", "en": "Arabic", "article": None},
    {"nl": "Grieks", "en": "Greek", "article": None},
    {"nl": "Turks", "en": "Turkish", "article": None},
    {"nl": "Pools", "en": "Polish", "article": None},
    {"nl": "Engels spreken", "en": "to speak English", "article": None},
    {"nl": "Frans spreken", "en": "to speak French", "article": None},
    {"nl": "Duits spreken", "en": "to speak German", "article": None},
    {"nl": "begrijpen", "en": "to understand", "article": None},
    {"nl": "begrip", "en": "understanding", "article": "het"},
    {"nl": "accent", "en": "accent", "article": "het"},
    {"nl": "taal", "en": "language", "article": "de"},
    {"nl": "woord", "en": "word", "article": "het"},
    {"nl": "zin", "en": "sentence", "article": "de"},
    {"nl": "vraag", "en": "question", "article": "de"},
    {"nl": "antwoord", "en": "answer", "article": "het"},
    {"nl": "naam", "en": "name", "article": "de"},
    {"nl": "beroep", "en": "profession", "article": "het"},
    {"nl": "student", "en": "student", "article": "de"},
    {"nl": "leerkracht", "en": "teacher", "article": "de"},
    {"nl": "professor", "en": "professor", "article": "de"},
    {"nl": "arts", "en": "doctor", "article": "de"},
    {"nl": "verpleegster", "en": "nurse", "article": "de"},
    {"nl": "apotheker", "en": "pharmacist", "article": "de"},
    {"nl": "tandarts", "en": "dentist", "article": "de"},
    {"nl": "advocaat", "en": "lawyer", "article": "de"},
    {"nl": "ingenieur", "en": "engineer", "article": "de"},
    {"nl": "architect", "en": "architect", "article": "de"},
    {"nl": "kunstenaar", "en": "artist", "article": "de"},
    {"nl": "schrijver", "en": "writer", "article": "de"},
    {"nl": "musicus", "en": "musician", "article": "de"},
    {"nl": "schilder", "en": "painter", "article": "de"},
    {"nl": "boer", "en": "farmer", "article": "de"},
    {"nl": "visser", "en": "fisherman", "article": "de"},
    {"nl": "timmerman", "en": "carpenter", "article": "de"},
    {"nl": "winkelier", "en": "shopkeeper", "article": "de"},
    {"nl": "bakker", "en": "baker", "article": "de"},
    {"nl": "slager", "en": "butcher", "article": "de"},
    {"nl": "groenteboer", "en": "greengrocer", "article": "de"},
    {"nl": "chauffeur", "en": "driver", "article": "de"},
    {"nl": "piloot", "en": "pilot", "article": "de"},
    {"nl": "machinist", "en": "engineer", "article": "de"},
    {"nl": "soldaat", "en": "soldier", "article": "de"},
    {"nl": "politieagent", "en": "police officer", "article": "de"},
    {"nl": "brandweerman", "en": "firefighter", "article": "de"},
    {"nl": "werknemer", "en": "employee", "article": "de"},
    {"nl": "werkgever", "en": "employer", "article": "de"},
    {"nl": "baas", "en": "boss", "article": "de"},
    {"nl": "collega", "en": "colleague", "article": "de"},
    {"nl": "vriend", "en": "friend", "article": "de"},
    {"nl": "vriendin", "en": "female friend", "article": "de"},
    {"nl": "kennis", "en": "acquaintance", "article": "de"},
    {"nl": "buurman", "en": "neighbor", "article": "de"},
    {"nl": "buurvrouw", "en": "female neighbor", "article": "de"},
    {"nl": "buur", "en": "neighbor", "article": "de"},
    {"nl": "eigenaar", "en": "owner", "article": "de"},
    {"nl": "huurder", "en": "tenant", "article": "de"},
    {"nl": "gast", "en": "guest", "article": "de"},
    {"nl": "gastheer", "en": "host", "article": "de"},
    {"nl": "gastvrouw", "en": "hostess", "article": "de"},
    {"nl": "klant", "en": "customer", "article": "de"},
    {"nl": "titel", "en": "title", "article": "de"},
    {"nl": "mevrouw", "en": "Mrs.", "article": "de"},
    {"nl": "meneer", "en": "Mr.", "article": "de"},
    {"nl": "juffrouw", "en": "Miss", "article": "de"},
    {"nl": "persoon", "en": "person", "article": "de"},
    {"nl": "mens", "en": "human", "article": "de"},
    {"nl": "paar", "en": "couple", "article": "het"},
    {"nl": "gezin", "en": "family", "article": "het"},
    {"nl": "huisnummer", "en": "house number", "article": "het"},
    {"nl": "straat", "en": "street", "article": "de"},
    {"nl": "adres", "en": "address", "article": "het"},
    {"nl": "stad", "en": "city", "article": "de"},
    {"nl": "plaats", "en": "place", "article": "de"},
    {"nl": "land", "en": "country", "article": "het"},
    {"nl": "continent", "en": "continent", "article": "het"},
    {"nl": "postcode", "en": "postcode", "article": "de"},
    {"nl": "telefoonnummer", "en": "telephone number", "article": "het"},
    {"nl": "mobiele nummer", "en": "mobile number", "article": "het"},
    {"nl": "email", "en": "email", "article": "het"},
    {"nl": "emailadres", "en": "email address", "article": "het"},
    {"nl": "leeftijd", "en": "age", "article": "de"},
    {"nl": "nationaliteit", "en": "nationality", "article": "de"},
    {"nl": "geboortedatum", "en": "date of birth", "article": "de"},
    {"nl": "geboorteplaats", "en": "place of birth", "article": "de"}
  ]
}

# Load course.json
with open('/Users/fmjduboc/Documents/MeStuff/Nederlands/klimop-mvp/content/course.json', 'r', encoding='utf-8') as f:
    course = json.load(f)

# Find max ID for theme 1
max_id = 0
for word in course['vocab']:
    if word['theme'] == 1 and 't01_' in word['id']:
        num = int(word['id'].split('_')[1])
        if num > max_id:
            max_id = num

# Add new words to theme 1
for word in vocab_data['1']:
    max_id += 1
    entry = {
        "id": f"t01_{max_id:04d}",
        "theme": 1,
        "nl": word['nl'],
        "article": word['article'],
        "en": word['en'],
        "tags": [],
        "image": f"/images/cards/t01_{max_id:04d}.png"
    }
    course['vocab'].append(entry)

# Save back
with open('/Users/fmjduboc/Documents/MeStuff/Nederlands/klimop-mvp/content/course.json', 'w', encoding='utf-8') as f:
    json.dump(course, f, ensure_ascii=False, indent=2)

print("Words added successfully")

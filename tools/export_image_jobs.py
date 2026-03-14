#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any


def canonical_token(s: str) -> str:
    s = s.lower().replace("’", "'").replace("`", "'")
    s = re.sub(r"\s+", " ", s).strip()
    return s.rstrip("!?.,")


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COURSE = ROOT / "apps/web/public/content/course.json"
DEFAULT_OUT_DIR = ROOT / "assets_raw/image_jobs"

COUNTRIES = {
    "england", "america", "australia", "france", "germany", "spain", "italy", "poland",
    "morocco", "turkey", "syria", "iraq", "afghanistan", "china", "netherlands", "belgium",
}
LANGUAGES = {
    "dutch", "english", "french", "german", "spanish", "italian", "polish", "arabic", "chinese",
}
HUMAN_KEYWORDS = {
    "i", "you", "he", "she", "we", "they", "person", "man", "woman",
    "teacher", "nurse", "cook", "cleaner", "hairdresser", "doctor", "student",
    "friend", "mother", "father", "brother", "sister", "child", "children",
}

# Literal, concrete scenes for abstract/function words.
EXPLICIT_SCENES: dict[str, dict[str, str]] = {
    "wie": {"scene": "two adults face each other; left adult points to right adult; a large question-mark icon floats above them"},
    "who": {"scene": "two adults face each other; left adult points to right adult; a large question-mark icon floats above them"},
    "wat": {"scene": "a blue box with lid open on a wooden table; warm yellow light glows from inside the box"},
    "what": {"scene": "a blue box with lid open on a wooden table; warm yellow light glows from inside the box"},
    "waar": {"scene": "a folded city map on a table; one orange location pin marks a point; one short route line is visible"},
    "where": {"scene": "a folded city map on a table; one orange location pin marks a point; one short route line is visible"},
    "welke": {"scene": "three square tiles in one row; middle tile has bright glowing border; left and right tiles are muted"},
    "which": {"scene": "three square tiles in one row; middle tile has bright glowing border; left and right tiles are muted"},
    "hoe": {"scene": "a hand pours water from a kettle into a cup; one curved orange arrow shows the pouring motion"},
    "how": {"scene": "a hand pours water from a kettle into a cup; one curved orange arrow shows the pouring motion"},
    "zijn": {"scene": "single adult person standing still in center frame, neutral pose, calm expression"},
    "to be": {"scene": "single adult person standing still in center frame, neutral pose, calm expression"},
    "niet": {"scene": "a sandwich on a plate; a big red prohibition circle and slash clearly overlays the sandwich"},
    "not": {"scene": "a sandwich on a plate; a big red prohibition circle and slash clearly overlays the sandwich"},
    "en": {"scene": "a red apple on the left and a yellow banana on the right; a clean plus symbol is between them"},
    "and": {"scene": "a red apple on the left and a yellow banana on the right; a clean plus symbol is between them"},
    "een": {"scene": "one red coffee mug centered on a table with lots of empty space around it"},
    "a": {"scene": "one red coffee mug centered on a table with lots of empty space around it"},
    "beetje": {"scene": "a teaspoon with a tiny pinch of sugar held above a tea cup"},
    "bit": {"scene": "a teaspoon with a tiny pinch of sugar held above a tea cup"},
    "in": {
        "scene": "a transparent glass jar at center; one red ball is fully inside the jar; jar interior is clearly visible",
        "must": "no ball outside the jar",
    },
    "uit": {
        "scene": "a transparent glass jar at center; jar is empty; one red ball sits outside the jar on the right side",
        "must": "no ball inside the jar",
    },
    "out": {
        "scene": "a transparent glass jar at center; jar is empty; one red ball sits outside the jar on the right side",
        "must": "no ball inside the jar",
    },
    "vandaan": {"scene": "small house icon on the left and office building icon on the right; one arrow goes left to right"},
    "from": {"scene": "small house icon on the left and office building icon on the right; one arrow goes left to right"},
    "bij": {"scene": "one person stands next to one large blue map pin marker"},
    "at": {"scene": "one person stands next to one large blue map pin marker"},
    "ik": {"scene": "single person touches chest with right hand in self-introduction gesture"},
    "i": {"scene": "single person touches chest with right hand in self-introduction gesture"},
    "jij": {"scene": "single person looks directly at viewer and points toward viewer"},
    "you": {"scene": "single person looks directly at viewer and points toward viewer"},
    "hij": {"scene": "single adult man, waist-up portrait, neutral expression"},
    "he": {"scene": "single adult man, waist-up portrait, neutral expression"},
    "zij": {"scene": "single adult woman, waist-up portrait, neutral expression"},
    "she": {"scene": "single adult woman, waist-up portrait, neutral expression"},
    "the": {"scene": "one blue cup in sharp focus at center; other cups are blurred in background"},
    "de": {"scene": "one blue cup in sharp focus at center; other cups are blurred in background"},
    "het": {"scene": "one blue cup in sharp focus at center; other cups are blurred in background"},
}

PHRASE_SCENES = {
    "good morning": "two people meeting and shaking hands in morning light",
    "good afternoon": "two people greeting each other outdoors in afternoon light",
    "bye": "person waving goodbye while walking away",
    "bye!": "person waving goodbye while walking away",
    "hello": "person smiling and waving hello",
    "hi": "person smiling and waving hello",
    "of course": "person giving a confident thumbs-up",
    "not much": "person shrugging shoulders with relaxed expression",
    "by the way": "person leaning in and giving side remark gesture",
    "in the evening": "city street scene at dusk with warm lights",
    "in the afternoon": "sunny afternoon street with soft shadows",
    "come on in": "person opening front door and inviting someone inside",
    "enjoy your meal!": "table with plated meal and person offering it politely",
    "just a moment": "person raising one finger to ask for a brief wait",
    "from ... to ...": "simple route line from left point to right point with one clear directional arrow",
    "am called": "person touching chest while wearing a blank name badge",
    "is going": "person walking forward on a sidewalk with motion implied",
    "get well soon": "person in bed receiving flowers from visitor",
    "good luck": "person crossing fingers with hopeful expression",
    "this afternoon": "sunny afternoon city scene with long soft shadows",
    "lives together": "two adults arranging items in one shared living room",
    "long for": "person looking at distant horizon with longing expression",
    "what time?": "large analog wall clock with one person pointing at it",
    "ten o’clock": "analog clock showing hour hand at ten and minute hand at twelve",
    "half past nine": "analog clock showing hour hand halfway between nine and ten",
    "around seven o’clock": "analog clock near seven with softly blurred uncertainty halo",
    "yes, of course": "person nodding with thumbs-up gesture",
    "yes, sure": "person nodding and making an okay hand sign",
    "anything else?": "shop counter with one person asking and another thinking",
    "for a bit": "small timer set for a short duration on table",
    "see you later": "person waving goodbye while walking away on street",
    "see you soon": "two people waving to each other with a small clock icon",
    "good idea!": "lightbulb icon above smiling person",
    "go out": "person stepping out through a doorway to street",
    "go ahead.": "person making inviting forward hand gesture",
    "nice weather, isn’t it!": "two people talking outside under bright sun and blue sky",
    "something nice": "gift box with ribbon on a table",
    "on the contrary": "two opposite arrows pointing different directions",
    "king’s day": "festive street with orange decorations and small flags",
    "saint nicholas": "holiday scene with gift shoe and wrapped presents",
    "it’s coming.": "calendar page flipping toward viewer with approaching arrow",
    "i’m hungry.": "person holding stomach with empty plate on table",
    "dutch meat-based snack": "fried croquette snack on plate with mustard dip",
    "total sandwich": "toasted sandwich cut diagonally on plate",
    "half a kilo": "kitchen scale with produce showing half capacity visually",
    "100 grams": "small kitchen scale with tiny measured portion of food",
    "look around": "person turning head while standing in a room",
    "once more": "circular repeat arrow around one object",
    "straight away": "running person with motion lines starting immediately",
    "point out": "person pointing clearly at one object on table",
    "put on": "person putting on a jacket in front of mirror",
    "such as": "one main object with two example objects beside it",
    "tells about": "person explaining a photo to another person",
    "fed up": "person with frustrated expression and crossed arms",
    "good looking": "well-dressed person standing confidently in portrait pose",
    "have a nice weekend": "person smiling and waving with weekend picnic basket",
    "long time no see": "two friends happily greeting each other after a long separation",
    "is getting better": "person recovering in bed and now smiling with improved posture",
}

PREPOSITION_SCENES = {
    "with": "red cup with a metal spoon inside",
    "without": "red cup with no spoon nearby",
    "on": "blue book on top of a wooden table",
    "under": "blue book under a wooden table",
    "behind": "red ball behind a blue box",
    "before": "timeline arrow with event A before event B",
    "after": "timeline arrow with event B after event A",
    "around": "person walking around a park bench in a circular path",
    "back": "person turning back toward home",
    "here": "person standing at a map pin marked current location",
    "there": "person pointing toward a distant location",
    "for": "gift box with a tag showing it is meant for someone",
    "of": "slice of cake next to a whole cake to show part-of relation",
    "by": "person standing by a bus stop sign",
    "during": "person working while a wall clock is visible in background",
    "to": "orange arrow pointing toward an open doorway",
}

CONJUNCTION_SCENES = {
    "or": "two option cards side by side with a divider between them",
    "but": "happy face icon on left and contrasting worried face icon on right",
    "because": "rain cloud on left and wet umbrella on right connected by causal arrow",
}

PRONOUN_SCENES = {
    "me": "person pointing at self with both hands",
    "my": "person holding one personal backpack close to chest",
    "his": "man standing beside one backpack that belongs to him",
    "her": "woman standing beside one backpack that belongs to her",
    "we": "two people standing together and smiling",
    "they": "small group of people standing together",
}

AUX_SCENES = {
    "am": "single person standing in center with clear identity pose",
    "is": "single person standing in center with clear identity pose",
    "are": "two people standing side by side in center frame",
    "do": "person actively doing a task with hands on an object",
    "does": "person actively doing a task with hands on an object",
    "can": "person successfully lifting a box with confident pose",
}

VERB_SCENES = {
    "work": "person typing on laptop at a desk with a small desk lamp",
    "write": "hand writing with a pen in an open notebook on table",
    "listen": "person wearing one earbud and tilting head to listen",
    "read": "person holding an open book and looking at the pages",
    "speak": "person speaking into a handheld microphone, mouth open",
    "spell": "hand placing letter blocks in a row on table",
    "meet": "two people shaking hands at a doorway",
    "go": "person walking toward a doorway with one forward step",
    "come": "person walking toward camera with welcoming hand gesture",
    "get": "person receiving a small package from another hand",
    "choose": "hand selecting one card from a small stack",
    "open": "hand opening a door with handle turned",
    "close": "hand closing a door with handle turned",
    "add": "hand adding one spoon of sugar to a cup",
    "fill in": "hand filling empty lines on a paper form",
    "describe": "person pointing at an object while speaking",
    "answer": "person raising hand in class to answer",
    "greet": "two people smiling and shaking hands",
    "relax": "person resting on sofa with closed eyes",
    "dress": "person putting on a jacket in front of mirror",
    "drink": "person drinking from a glass",
    "wash": "person washing hands under running tap",
    "cook": "person stirring a pot on a stove",
    "hike": "person walking on a mountain trail with backpack",
    "run": "person running on a park path",
    "swim": "person swimming in a lane pool",
    "sleep": "person sleeping in bed under blanket",
    "call": "person holding smartphone to ear during a call",
}

ADJECTIVE_SCENES = {
    "big": "large red suitcase next to a small blue suitcase for size contrast",
    "small": "small red suitcase next to a large blue suitcase for size contrast",
    "high": "ball on top shelf and ladder below",
    "low": "ball on floor near a low stool",
    "long": "long rope stretched horizontally across table",
    "short": "short rope piece next to a much longer rope",
    "light": "single white feather floating above hand",
    "heavy": "heavy metal dumbbell on floor next to shoe",
    "cold": "glass with ice cubes and visible condensation droplets",
    "hot": "cup with visible steam rising upward",
    "empty": "empty transparent bowl on table",
    "full": "transparent bowl filled with apples",
}

COLOR_SCENES = {
    "red": "single bright red apple on neutral table",
    "blue": "single blue ceramic cup on neutral table",
    "green": "single green leaf on wooden table",
    "yellow": "single yellow lemon on neutral table",
    "black": "single black shoe on neutral floor",
    "white": "single white plate on table",
    "brown": "single brown loaf of bread on board",
    "grey": "single grey umbrella on floor",
    "gold": "single gold ring on dark cloth",
}

MONTH_SCENES = {
    "january": "calendar page with snowflake icon and winter coat",
    "february": "calendar page with winter scarf and light snow icon",
    "march": "calendar page with first spring flower blooming",
    "april": "calendar page with rain cloud and umbrella",
    "may": "calendar page with bright flowers and sunshine",
    "june": "calendar page with sun and sunglasses",
    "july": "calendar page with beach umbrella and sun",
    "august": "calendar page with summer fruit and warm sun",
    "september": "calendar page with school backpack and autumn leaf",
    "october": "calendar page with orange leaves and windy sky",
    "november": "calendar page with raincoat and grey clouds",
    "december": "calendar page with festive lights and wrapped gifts",
}

WEEKDAY_SCENES = {
    "monday": "desk calendar opened at start of week with coffee mug",
    "tuesday": "desk calendar with mid-week work items and pen",
    "wednesday": "desk calendar at week midpoint with notebook",
    "thursday": "desk calendar near end of work week with laptop",
    "friday": "desk calendar with weekend approaching and cheerful mood",
    "saturday": "weekend scene with relaxed breakfast table",
    "sunday": "calm home scene with tea and book on sofa",
}

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90, "hundred": 100,
}

PLACE_SCENES = {
    "the primary school": "front view of a small primary school building with playground",
    "the school": "front view of a school building and bicycles parked outside",
    "the day-care centre": "day-care room with colorful toys and small chairs",
    "the café": "cozy café interior with coffee cups on counter",
    "the hair salon": "hair salon interior with mirror and barber chair",
    "the clothing store": "clothing store interior with racks and folded shirts",
    "the supermarket": "supermarket aisle with fruit shelves and shopping cart",
    "central station": "train station platform with one train and clock",
}

PROFESSION_SCENES = {
    "the teacher": "teacher standing near a whiteboard, pointing with marker",
    "the hairdresser": "hairdresser holding scissors beside seated client",
    "the police officer": "police officer in uniform standing near patrol car",
    "the garbage collector": "worker pushing a green garbage bin on street",
    "the nurse": "nurse in scrubs with stethoscope in clinic room",
    "the cleaner": "cleaner holding mop and bucket in hallway",
    "the car mechanic": "mechanic looking into open car hood with wrench",
    "the cook": "cook in kitchen stirring pot on stove",
}

FAMILY_SCENES = {
    "the mother": "adult woman and child standing together indoors",
    "the father": "adult man and child standing together indoors",
    "the family": "small family group smiling together in living room",
    "the brother": "two siblings standing side by side indoors",
    "the sister": "two siblings standing side by side indoors",
    "the son": "young boy standing next to parent",
    "the daughter": "young girl standing next to parent",
}

NOUN_SCENES = {
    "work": "desk with laptop, notebook, and coffee mug in office setting",
    "clothing": "clothes rack with shirts and folded pants",
    "table": "wooden dining table with two plates and glasses",
    "time": "large analog wall clock showing clear hands",
    "moment": "small stopwatch on table with one hand pointing",
    "number": "abacus with colored beads aligned in rows",
    "question": "person raising hand with one large question-mark icon nearby",
    "answer": "person giving thumbs-up with one checkmark icon",
    "information": "person reading an information board with icons only",
    "sentence": "open notebook with one highlighted line shape",
}

CONCEPT_SCENES = {
    "thanks": "person placing hand on chest in thankful gesture",
    "okay": "person giving a thumbs-up gesture",
    "good": "smiling face icon with green checkmark",
    "well": "healthy person standing confidently with thumbs-up",
    "bad": "sad face icon with red cross mark",
    "very": "object with strong glowing outline to show high intensity",
    "also": "two matching objects placed side by side",
    "too": "cup filled beyond rim with liquid spilling slightly",
    "only": "single object centered while background objects are blurred",
    "about": "map pin with small circular area around it",
    "each": "row of apples where each apple has a small checkmark badge",
    "see": "single eye looking at a bright red ball",
    "have": "person holding one box in both hands",
    "your": "person pointing to viewer and holding one backpack",
    "complete": "jigsaw puzzle fully assembled on table",
    "is correct": "green checkmark next to a solved puzzle piece",
    "beautiful": "fresh bouquet of flowers in sunlight",
    "young": "young adult portrait with fresh energetic expression",
    "old": "elderly adult portrait with grey hair and calm expression",
    "free": "open birdcage with a bird flying out",
    "tasty": "steaming plated meal with appetizing appearance",
    "difficult": "tangled rope knot on table",
    "nasty": "spoiled food with unpleasant smell lines",
    "fat": "thick candle next to a thin candle for body-width contrast",
    "no": "large red prohibition sign centered on neutral background",
    "this": "person pointing at one nearby object in foreground",
    "that": "person pointing at one distant object in background",
    "self": "person looking in mirror reflection and touching chest",
}

PHRASE_SCENES_CANON = {canonical_token(k): v for k, v in PHRASE_SCENES.items()}
PREPOSITION_SCENES_CANON = {canonical_token(k): v for k, v in PREPOSITION_SCENES.items()}
CONJUNCTION_SCENES_CANON = {canonical_token(k): v for k, v in CONJUNCTION_SCENES.items()}
PRONOUN_SCENES_CANON = {canonical_token(k): v for k, v in PRONOUN_SCENES.items()}
AUX_SCENES_CANON = {canonical_token(k): v for k, v in AUX_SCENES.items()}
CONCEPT_SCENES_CANON = {canonical_token(k): v for k, v in CONCEPT_SCENES.items()}
ADJECTIVE_SCENES_CANON = {canonical_token(k): v for k, v in ADJECTIVE_SCENES.items()}
COLOR_SCENES_CANON = {canonical_token(k): v for k, v in COLOR_SCENES.items()}

STYLE_GUIDE = (
    "stylized semi-realistic digital illustration, clean shapes, smooth shading, "
    "simple composition, one central idea, high readability at thumbnail size, medium-high contrast"
)
HUMAN_STYLE_GUIDE = (
    "human-focused framing, waist-up when possible, natural skin tones, realistic proportions"
)
OBJECT_STYLE_GUIDE = "single clear object or very simple visual metaphor"
PALETTE_CHOICES = [
    "coral, apricot, and turquoise accents",
    "warm amber, teal, and cream accents",
    "emerald, peach, and sand accents",
    "cobalt, orange, and warm gray accents",
    "magenta, cyan, and beige accents",
    "olive, terracotta, and ivory accents",
]
BACKGROUND_CHOICES = [
    "soft gradient background with warm and cool tones",
    "painterly backdrop with peach, teal, and deep blue",
    "cinematic dusk gradient with navy, rose, and warm gold",
    "studio backdrop with plum, turquoise, and sunset orange",
]
HUMAN_VARIATIONS = [
    "young adult with short curly hair and green jacket",
    "adult with dark straight hair and mustard sweater",
    "adult with braided hair and red shirt",
    "middle-aged adult with wavy hair and denim jacket",
    "adult with shaved head and orange hoodie",
    "adult with ponytail and patterned blouse",
]
NEGATIVE_PROMPT = (
    "text, letters, words, typography, subtitle, title, label, watermark, "
    "alphabet, single letter, initials, glyphs, readable writing, captions, signs with text, "
    "book covers, street signs, posters, name tags, flags with text, "
    "collage, split screen, comic panels, grid layout, card frame, white border, UI, interface"
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def normalize_token(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def pick_variant(card_id: str, options: list[str]) -> str:
    if not options:
        return ""
    h = hashlib.sha1(card_id.encode("utf-8")).hexdigest()
    return options[int(h[:8], 16) % len(options)]


def strip_article(s: str) -> str:
    return re.sub(r"^(the|a|an)\s+", "", s).strip()


def normalize_verb(token: str) -> str:
    t = token.strip()
    if t.startswith("to "):
        t = t[3:].strip()
    if t.endswith("ies") and len(t) > 4:
        return t[:-3] + "y"
    if t.endswith("es") and len(t) > 4:
        return t[:-2]
    if t.endswith("s") and len(t) > 3:
        return t[:-1]
    return t


def scene_from_translation(nl: str, en: str) -> dict[str, str]:
    en_norm = normalize_token(en)
    nl_norm = normalize_token(nl)
    en_key = canonical_token(en_norm)
    nl_key = canonical_token(nl_norm)

    if en_key in EXPLICIT_SCENES:
        return EXPLICIT_SCENES[en_key]
    if nl_key in EXPLICIT_SCENES:
        return EXPLICIT_SCENES[nl_key]
    if en_key in PHRASE_SCENES_CANON:
        return {"scene": PHRASE_SCENES_CANON[en_key]}
    if en_key in PREPOSITION_SCENES_CANON:
        return {"scene": PREPOSITION_SCENES_CANON[en_key]}
    if en_key in CONJUNCTION_SCENES_CANON:
        return {"scene": CONJUNCTION_SCENES_CANON[en_key]}
    if en_key in PRONOUN_SCENES_CANON:
        return {"scene": PRONOUN_SCENES_CANON[en_key]}
    if en_key in AUX_SCENES_CANON:
        return {"scene": AUX_SCENES_CANON[en_key]}

    if en_key in COUNTRIES:
        return {"scene": f"national flag of {en_key}, realistic fabric texture, flag centered in frame"}
    if en_key in LANGUAGES:
        return {"scene": f"two people talking face to face, language-learning context for {en_key}"}
    if en_key in CONCEPT_SCENES_CANON:
        return {"scene": CONCEPT_SCENES_CANON[en_key]}

    if en_key in ADJECTIVE_SCENES_CANON:
        return {"scene": ADJECTIVE_SCENES_CANON[en_key]}
    if en_key in COLOR_SCENES_CANON:
        return {"scene": COLOR_SCENES_CANON[en_key]}
    if en_key in MONTH_SCENES:
        return {"scene": MONTH_SCENES[en_key]}
    if en_key in WEEKDAY_SCENES:
        return {"scene": WEEKDAY_SCENES[en_key]}
    if en_key in NUMBER_WORDS:
        n = NUMBER_WORDS[en_key]
        return {"scene": f"{n} colored circles arranged neatly in a row on a table"}
    if en_norm.startswith("is "):
        return scene_from_translation(nl, en_norm[3:])
    if en_norm.startswith("am "):
        return scene_from_translation(nl, en_norm[3:])
    if en_norm.startswith("are "):
        return scene_from_translation(nl, en_norm[4:])

    verb = normalize_verb(en_norm)
    if verb in VERB_SCENES:
        return {"scene": VERB_SCENES[verb]}
    if en_norm.startswith("to "):
        phrase = en_norm[3:].strip()
        if phrase in VERB_SCENES:
            return {"scene": VERB_SCENES[phrase]}
        if phrase == "(where)":
            return {"scene": "folded city map with one bright location pin"}
        if phrase == "must":
            return {"scene": "person checking a to-do list with one mandatory item marked"}
        if phrase == "say hello":
            return {"scene": "person waving hello with friendly smile"}
        if phrase == "talk about":
            return {"scene": "two people discussing one object on a table"}
        if phrase == "listen to music":
            return {"scene": "person wearing headphones listening to music from phone"}
        if phrase == "get dressed":
            return {"scene": "person putting on shirt in front of mirror"}
        if phrase == "play football":
            return {"scene": "person kicking a football on grass field"}
        if phrase == "play tennis":
            return {"scene": "person serving tennis ball with racket on court"}
        if phrase == "play sports":
            return {"scene": "person exercising with sports cone and ball"}
        if phrase == "do grocery shopping":
            return {"scene": "person pushing shopping cart in supermarket aisle"}
        if phrase == "have lunch":
            return {"scene": "person eating lunch at table with plate and water glass"}
        if phrase == "have breakfast":
            return {"scene": "person eating breakfast with bread and cup of tea"}
        if phrase == "watch television":
            return {"scene": "person sitting on sofa watching television screen"}
        if phrase == "use the internet":
            return {"scene": "person using laptop with browser-like icons on screen"}
        if phrase == "do homework":
            return {"scene": "student writing homework at desk with open notebook"}
        if phrase == "do fitness":
            return {"scene": "person doing fitness exercise with dumbbells"}
        if phrase == "brush your teeth":
            return {"scene": "person brushing teeth in bathroom mirror"}
        if phrase == "comb your hair":
            return {"scene": "person combing hair in front of mirror"}
        if phrase == "e-mail":
            return {"scene": "person typing an email on laptop with envelope icon"}
        if phrase.startswith("play "):
            return {"scene": f"person playing {phrase[5:]} in an obvious sports setting"}
        if phrase.startswith("listen to "):
            return {"scene": f"person wearing headphones listening to {phrase[10:]} audio"}
        if phrase.startswith("do "):
            return {"scene": f"person doing {phrase[3:]} with clear tools and context"}
        if phrase.startswith("have "):
            return {"scene": f"person having {phrase[5:]} at a table"}
        if phrase.startswith("take "):
            return {"scene": f"person taking {phrase[5:]} from a shelf"}
        if phrase.startswith("watch "):
            return {"scene": f"person watching {phrase[6:]} on a screen"}
        if phrase.startswith("brush "):
            return {"scene": f"person using a brush for {phrase[6:]}"}
        return {"scene": f"single person clearly performing action '{phrase}' with one obvious object"}

    if en_norm in PLACE_SCENES:
        return {"scene": PLACE_SCENES[en_norm]}
    if en_norm in PROFESSION_SCENES:
        return {"scene": PROFESSION_SCENES[en_norm]}

    noun = strip_article(en_norm)
    noun_with_the = f"the {noun}"
    if noun_with_the in PLACE_SCENES:
        return {"scene": PLACE_SCENES[noun_with_the]}
    if noun_with_the in PROFESSION_SCENES:
        return {"scene": PROFESSION_SCENES[noun_with_the]}
    if noun_with_the in FAMILY_SCENES:
        return {"scene": FAMILY_SCENES[noun_with_the]}
    if noun in NOUN_SCENES:
        return {"scene": NOUN_SCENES[noun]}

    if noun in {"name", "country", "language", "alphabet", "letter", "dialogue", "text"}:
        return {"scene": f"single clean icon-style object representing {noun}, centered on table"}

    if en_norm.startswith("a ") or en_norm.startswith("the ") or en_norm.startswith("an "):
        noun_phrase = strip_article(en_norm)
        return {"scene": f"single clear {noun_phrase} in realistic context, centered and easy to recognize"}

    if len(en_norm.split()) == 1:
        w = en_key
        if w.endswith("ly"):
            return {"scene": f"person performing an action in a way that represents '{w}' clearly"}
        if w.endswith("ed") or w.endswith("ing"):
            return {"scene": f"person clearly performing action '{w}' with one obvious object"}
        if w.endswith("s") and len(w) > 3:
            return {"scene": f"person clearly performing action '{w}' with one obvious object"}
        return {"scene": f"single realistic object scene representing '{w}' with clear visual context"}

    # Fallback: still concrete and visual, not abstract wording.
    target = noun if noun else nl_norm or "object"
    return {"scene": f"one clear literal scene for phrase '{target}' with one person and concrete props in realistic context"}


def is_human_concept(nl: str, en: str, scene: str) -> bool:
    token_words = set(re.findall(r"[a-zA-Z]+", normalize_token(f"{nl} {en} {scene}")))
    if token_words & HUMAN_KEYWORDS:
        return True
    if nl.endswith(("er", "ster", "kundige")):
        return True
    if any(x in token_words for x in {"adult", "person", "man", "woman", "teacher", "nurse", "mechanic"}):
        return True
    return False


def build_prompt(card: dict[str, Any], card_id: str, prefix: str) -> str:
    nl = str(card.get("nl", "")).strip()
    en = str(card.get("en") or "").strip()
    scene_info = scene_from_translation(nl, en)
    scene = scene_info["scene"]
    must = scene_info.get("must", "")

    human = is_human_concept(nl, en, scene)
    style = HUMAN_STYLE_GUIDE if human else OBJECT_STYLE_GUIDE
    palette = pick_variant(card_id, PALETTE_CHOICES)
    background = pick_variant(card_id + "_bg", BACKGROUND_CHOICES)
    human_variant = pick_variant(card_id + "_human", HUMAN_VARIATIONS)
    identity_hint = f" person look: {human_variant}." if human else ""
    must_clause = f" critical constraint: {must}." if must else ""

    style_anchor = prefix.strip() if prefix.strip() else "stylized semi-realistic illustration"
    return (
        f"{style_anchor}. Exact scene: {scene}.{must_clause} "
        f"Render literally as described; do not replace with abstract symbols. "
        f"Style: {STYLE_GUIDE}. {style}. "
        f"Colors: {palette}. Background: {background}. "
        f"single image, no collage, no panels, no grid.{identity_hint} "
        f"no text, letters, or numbers."
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Export flashcard image generation jobs to CSV + JSON for external generation.")
    ap.add_argument("--course", default=str(DEFAULT_COURSE), help="Path to course.json")
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Output folder")
    ap.add_argument("--base-name", default="flashcard_image_jobs", help="Output base filename")
    ap.add_argument(
        "--positive-prefix",
        default="stylized semi-realistic illustration",
        help="Style anchor at start of positive prompt",
    )
    ap.add_argument("--width", type=int, default=512)
    ap.add_argument("--height", type=int, default=512)
    args = ap.parse_args()

    course_path = Path(args.course).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    ensure_dir(out_dir)

    course = load_json(course_path)
    themes = {int(t["id"]): str(t["title"]) for t in course.get("themes", [])}
    vocab = list(course.get("vocab", []))
    if not vocab:
        raise RuntimeError("No vocab entries found in course.json")

    rows: list[dict[str, Any]] = []
    for idx, card in enumerate(vocab):
        card_id = str(card.get("id", f"card_{idx:04d}"))
        theme_id = int(card.get("theme", 0))
        theme_title = themes.get(theme_id, "General")
        nl = str(card.get("nl", "")).strip()
        article = card.get("article")
        en = str(card.get("en") or "").strip()
        prompt = build_prompt(card, card_id, args.positive_prefix)
        filename = f"{card_id}.png"

        rows.append(
            {
                "id": card_id,
                "theme_id": theme_id,
                "theme_title": theme_title,
                "article": article if article else "",
                "nl": nl,
                "en": en,
                "width": args.width,
                "height": args.height,
                "prompt": prompt,
                "negative_prompt": NEGATIVE_PROMPT,
                "output_filename": filename,
                "output_rel_path": f"/images/cards/{filename}",
            }
        )

    json_path = out_dir / f"{args.base_name}.json"
    csv_path = out_dir / f"{args.base_name}.csv"

    payload = {
        "meta": {
            "source_course": str(course_path),
            "count": len(rows),
            "width": args.width,
            "height": args.height,
        },
        "jobs": rows,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    fieldnames = [
        "id",
        "theme_id",
        "theme_title",
        "article",
        "nl",
        "en",
        "width",
        "height",
        "prompt",
        "negative_prompt",
        "output_filename",
        "output_rel_path",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow(row)

    print(f"Exported {len(rows)} jobs:")
    print(f"- JSON: {json_path}")
    print(f"- CSV : {csv_path}")
    print("Generate images with exact output_filename to make import fully automatic.")


if __name__ == "__main__":
    main()

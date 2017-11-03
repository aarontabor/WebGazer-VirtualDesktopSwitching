# repair the hints files by adding a new column `minimum_switches`

from csv import DictReader, DictWriter

headers = 'category index minimum_switches'.split()

switch_distances = {
    ('Nouns', 'Nouns'): 0,
    ('Nouns', 'Verbs'): 1,
    ('Nouns', 'Adjectives'): 2,
    ('Verbs', 'Nouns'): 1,
    ('Verbs', 'Verbs'): 0,
    ('Verbs', 'Adjectives'): 1,
    ('Adjectives', 'Nouns'): 2,
    ('Adjectives', 'Verbs'): 1,
    ('Adjectives', 'Adjectives'): 0,
  }


reader = DictReader(open('hints.csv'))
hints = [row for row in reader]

previous_hint = {'category': 'Verbs'}
for hint in hints:
  hint['minimum_switches'] = switch_distances[previous_hint['category'], hint['category']]
  previous_hint = hint


writer = DictWriter(open('hints-repaired.csv', 'w+'), fieldnames=headers)
writer.writeheader()
writer.writerows(hints)

// The messages a visitor can leave on the note wall in the foyer.
//
// Visitors can't type anything: they shuffle through these, and the server adds where they are.
// Each note stores the number of its message, so only ever ADD to the end of this list. Rewording
// one changes every note that already uses it, and removing or reordering them mixes notes up.
// Every message is followed by "from" and a place, e.g. "With love from Lisbon, Portugal".

export const MESSAGES = [
  'With love',
  'Greetings',
  'Hello',
  'Waving',
  'A big wave',
  'Warm wishes',
  'Best wishes',
  'Cheers',
  'Good vibes',
  'Sending a smile',
  'Passing through',
  'A quick hello',
  'High fives',
  'All the best',
];

// Sticky note colours: the visitor picks one, and the note stores its number. Add to the end only.
export const COLOURS = ['#FFE58F', '#FFC9D9', '#BFE6F6', '#CDEDC1', '#FFD4AE'];

export const UNKNOWN_PLACE = 'somewhere on Earth';

export function noteText(note) {
  return `${MESSAGES[note.m] || MESSAGES[0]} from ${note.place || UNKNOWN_PLACE}`;
}

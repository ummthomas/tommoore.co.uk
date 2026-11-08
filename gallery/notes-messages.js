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

// The wall's note area, in centimetres. Visitors put a note anywhere in it, in steps of `snap`, and
// each note stores where its middle is (x across from the left, y down from the top). Newer notes
// cover older ones. Don't change these once notes exist, or old notes will move.
export const BOARD = { width: 600, height: 300, top: 44, margin: 16, note: 40, snap: 4 };

// The range a note's middle can sit in
export const BOUNDS = {
  x0: BOARD.margin + BOARD.note / 2,
  x1: BOARD.width - BOARD.margin - BOARD.note / 2,
  y0: BOARD.top + BOARD.note / 2,
  y1: BOARD.height - BOARD.margin - BOARD.note / 2,
};

export function noteText(note) {
  return `${MESSAGES[note.m] || MESSAGES[0]} from ${note.place || UNKNOWN_PLACE}`;
}

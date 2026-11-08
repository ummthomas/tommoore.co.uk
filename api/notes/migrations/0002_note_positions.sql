-- Where on the wall each note was put, in centimetres from the top left of the note area (see
-- BOARD in gallery/notes-messages.js). Notes from before this have none, and the gallery finds them
-- a place from their number.
ALTER TABLE notes ADD COLUMN x INTEGER;
ALTER TABLE notes ADD COLUMN y INTEGER;

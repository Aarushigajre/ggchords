import { readFileSync } from "node:fs";
import { buildSong } from "../src/lib/songs/songbook";
import { voicingsFor } from "../src/lib/music/voicing";
import { chordSymbol } from "../src/lib/music/chords";
import { nameInKey } from "../src/lib/music/notes";
import { soundedMidi } from "../src/lib/music/fretboard";

for (const f of ["shangri-la", "shady-grove", "scarborough-fair"]) {
  const entry = { id: f, file: `data/songs/${f}.chopro`, rights: "public-domain" as const, genre: ["Traditional"] };
  const song = buildSong(entry, readFileSync(entry.file, "utf8"));
  const per = song.progression.map((c) => {
    const set = voicingsFor(c, { key: song.key, prefer: chordSymbol(c, (p) => nameInKey(p, song.key)) });
    return set.preferred ? soundedMidi(set.preferred).length : 0;
  });
  console.log(
    f.padEnd(20),
    "key:", song.key.letter + song.key.mode,
    "| chords:", song.progression.length,
    "| notes/chord:", per.join(","),
    "| total:", per.reduce((a, b) => a + b, 0),
  );
}

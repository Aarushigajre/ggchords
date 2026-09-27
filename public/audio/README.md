# Recordings

Drop song audio files here and they will appear on the song pages.

## Why this folder is nearly empty

The **songs** in this project are public domain — both the words and the tune.
A **recording** of a public-domain song is a separate copyrighted work, owned by
the performer or their label, and is not covered by the song being free.

In the United States, sound recordings made before 15 February 1972 are in a
unsettled state, and will not enter the public domain before **2067** at the
earliest. That includes the Library of Congress folk field recordings from the
1930s and 40s. So third-party recordings are *linked to* on the song pages,
never hosted here.

## Adding your own recording

Record the songs yourself and you hold the rights, so you can publish them
freely. Then:

1. Put the file here, e.g. `shangri-la.mp3`
2. Add a `recording` block to the song in `src/lib/songs/songbook.ts`:

```ts
{
  id: "shangri-la",
  file: "data/songs/shangri-la.chopro",
  rights: "public-domain",
  // ...
  recording: {
    src: "audio/shangri-la.mp3",
    credit: "Recorded by Gajre",
    license: "Released under CC BY 4.0",
    year: 2026,
  },
}
```

The player appears at the top of the song page automatically.

## `license` is required

The field is not optional, and that is the point. A recording published without
a stated licence is exactly the ambiguity this project exists to avoid, so the
type system refuses to accept one.

Any of these work:
- "Recorded by the site owner, released under CC BY 4.0"
- "Public domain, dedicated to the public by the performer"
- "Licensed for non-commercial use by the performer"

## Format

- MP3 or M4A, mono is fine — these are voice-and-guitar recordings
- 128 kbps is plenty; speech and guitar do not need more
- Keep files small. This is a static site, so every kilobyte is a kilobyte the
  visitor downloads.

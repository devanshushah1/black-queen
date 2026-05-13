# Audio Attribution

The 4 audio files in this directory ship as zero-byte placeholders
so the audio pipeline is wired end-to-end without blocking on
curation. To enable real sounds, replace each file with a small
(<40 KB) CC0 or CC-BY clip from freesound.org or similar.

Suggested searches (CC0 preferred):

| File         | Suggested search                                       | Notes                                |
|--------------|--------------------------------------------------------|--------------------------------------|
| shuffle.mp3  | "card shuffle short"                                   | ~600 ms, fires once before deal-out  |
| whip.mp3     | "card flick" or "card whoosh short"                    | <120 ms, plays ~52× during deal      |
| thump.mp3    | "card on table" or "card flop felt"                    | <100 ms, fires on every card play    |
| sweep.mp3    | "card sweep" or "cards scoop"                          | ~400 ms, fires once per trick collect|

If a clip is CC-BY, add a line below following the format
"<file> — <author> — <source URL>". CC0 clips need no attribution.

## Volumes

Pre-balanced in `src/client/sounds.ts`. Loudest sound caps at 0.5
of linear maximum. If your replacement clips are louder than the
placeholders would have been, adjust the VOLUME table there.

## Attributions

(none yet — currently shipping silent placeholders)

# ThinkPad Notes

A skeuomorphic plain-text notepad shaped like an IBM ThinkPad from the last
years before Lenovo — matte black plastic, a chunky bezel, a red TrackPoint,
the blue Access IBM button, and a ThinkLight above the screen.

Open `index.html` in a browser. That's the whole install: no build step, no
dependencies, no server.

```
git clone <this repo> && open index.html
# or, if you'd rather serve it:  python3 -m http.server
```

**One file instead:** `node build.js` folds the whole machine into
`dist/thinkpad-notes.html` — a single self-contained page you can drop on a
USB stick, email to yourself, or double-click from anywhere. `--fragment`
writes the same page without the document wrapper, for hosts that supply
their own.

**On the web:** `.github/workflows/pages.yml` publishes the repository to
GitHub Pages on every push. Pages has to be switched on once by hand —
*Settings > Pages > Source: **GitHub Actions*** — because a workflow token is
not allowed to switch it on for you; until then the job reports that and
stops instead of failing. The site serves `index.html` at the root and the
one-file copy at `/dist/thinkpad-notes.html`.

## What it does

Plain text notes, nothing else. The first line of a note becomes its title.
It saves as you type into `localStorage` — **this browser, this machine, no
account, no sync, no network**. Clearing site data erases everything, so
export anything you'd hate to lose.

- Find with match counts, highlighting behind the text, and `F3` to step through
- Autosave (and `Ctrl+S` if you don't trust autosave — nobody does)
- Delete is reversible: notes go to a trash for 30 days, with Undo in the status bar
- Two tabs on the same notes merge instead of overwriting each other
- A warning when localStorage is running out, rather than a failed save
- Export one note or all of them as `.txt`; drag a `.txt` in to open it
- Print (`Ctrl+P`) prints just the text, no chrome
- `F5` stamps the time and date, the way Notepad always has

## The panel

A true 4:3 screen, the way every ThinkPad was before widescreen. `app.js`
measures the case around it and sizes the panel so the whole machine lands
inside your window, on every resize.

The keyboard starts folded away, which on a 1920x1080 display gives about a
960x720 panel — near enough to what a T-series actually ran. **View >
Keyboard** unfolds it, at the cost of roughly 170 vertical pixels of screen
(740x555). The panel stays 4:3 either way; **Settings > Machine > Panel
shape** offers 16:10 or fill-the-window if you'd rather have the pixels.

## Settings

**Ctrl+comma**, or **Format > Settings**. Everything is saved the moment you
change it.

| Tab | What's in it |
| --- | --- |
| **Machine** | Show the machine at all, keyboard, TrackPoint buttons, indicator lights, case finish (matte black / graphite / titanium), TrackPoint cap (cat's tongue / soft dome / eraser head), desk surface, panel shape, whether the deck lies flat, whether the battery light is real, power-on self test, screensaver delay, ThinkLight, screen glare, LCD grain, key click and its volume |
| **Screen** | Colour scheme (classic grey / warm paper / midnight / amber monochrome / green phosphor), typeface preset, interface face, note face, note size, line spacing, word wrap, tab width, spell check, status bar |
| **Notes** | Note list on or off, list on the left or right, list width, sort by last edited / created / title, date format, and whether opening the app resumes your last note or starts a blank one |
| **Data** | Back up everything to `.json`, restore from a backup, empty the trash, reset every setting, erase all notes — with a live count of notes, words, storage used and what's in the trash |

Turning the machine off entirely (**Machine > Show the machine**) leaves the
notepad alone in the window, which is the mode to use when you actually have
to get work done.

## Two typefaces

| Mode | Chrome | Page | Why |
| --- | --- | --- | --- |
| **Period correct** (default) | Tahoma | Courier New | What a ThinkPad actually put on a screen around 2001 |
| **IBM Plex** | IBM Plex Sans | IBM Plex Mono | Gloriously anachronistic: IBM didn't draw Plex until 2017 |

Switch in **Format**, or click the typeface name in the status bar. The choice
is remembered. Plex is pulled from Google Fonts when you're online and falls
back to the period stack when you aren't, so the app works offline either way.

Either face can be picked apart in **Settings > Screen** — Verdana, MS Sans
Serif or a system stack for the chrome; Lucida Console, Andale Mono, Consolas
or a system mono for the page — which switches the preset to Custom.

## Things on the machine that work

| Part | What it does |
| --- | --- |
| ThinkLight (the lamp above the screen) | Darkens the room and throws a warm cone over the keys. `Alt+L` |
| Keyboard | Folded away by default — **View > Keyboard** brings it back |
| TrackPoint | Push the red nub to scroll a long note, like the real thing |
| Mouse buttons | Left and right walk through your notes |
| Access IBM (blue button) | Help, shortcuts, and how much storage you've used |
| Volume rocker | Key-click volume. The dot lights when muted — it starts muted, because you're at work |
| Power button | Standby. Click anywhere to wake |
| Battery light | Follows this laptop where the browser will say: amber below 20%, pulsing while charging |
| Drive light | Flickers on every save, and sits amber when storage is nearly full |
| Keyboard | Mirrors what you actually type; click the caps to type with the mouse |
| LEDs | Power, battery, sleep, drive (flickers on every save), Num Lock, Caps Lock |

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Alt+N` | New note |
| `Ctrl+S` | Save now |
| `Ctrl+F` / `Alt+I` | Find |
| `Ctrl+D` | Delete note |
| `Ctrl+[` / `Ctrl+]` | Previous / next note |
| `Ctrl+E` | Export `.txt` |
| `Ctrl+P` | Print |
| `F5` | Stamp time and date |
| `Alt+L` | ThinkLight |
| `Ctrl+,` | Settings |
| `Alt+=` / `Alt+-` | Bigger / smaller text |
| `Alt+F` `Alt+E` `Alt+O` `Alt+V` `Alt+H` | Open the menus |
| `Esc` | Close a menu or dialog |

`Ctrl+N` and `Ctrl+T` belong to the browser and can't be intercepted, which is
why New is `Alt+N`.

## Find

Type in the **Find** box and every match lights up behind the text in the
editor, the counter shows `3/12`, and each note in the list carries a badge
with how many matches it holds. `F3` and `Shift+F3` step through them,
wrapping around the ends; `Enter` in the Find box does the same.

## Two things it does for the era rather than for you

Both off by default, both in **Settings > Machine**.

**Power-on self test.** Switch it on and the machine posts before it hands
over: the striped IBM logo, the memory counted out to 262144 KB, the ThinkPad
line, and a note about the setup utility nobody ever pressed in time. About
two and a half seconds, and any key skips it — that key is swallowed rather
than typed into your note.

**Screensaver.** A starfield, because it was always a starfield. Off, or after
1, 5 or 15 minutes idle. Anything wakes it, and the key that wakes it doesn't
land in the note either. **View > Start Screensaver** runs it on demand, and
`prefers-reduced-motion` gives you the stars without the motion.

## When something goes wrong

Losing notes is the only unforgivable bug in a notepad, so:

- **Delete is reversible.** A deleted note is tombstoned, not erased. Undo sits
  in the status bar for 30 seconds; the note stays in the trash for 30 days.
  Empty it yourself in **Settings > Data**.
- **Two tabs no longer fight.** They used to overwrite each other silently.
  Now each tab merges what the other saved — newest edit of each note wins —
  and a sentence you are halfway through typing is never overwritten.
- **A full disk says so.** The drive light goes amber past 80%, and a failed
  save is reported instead of swallowed.
- **A dead screen explains itself.** If a script fails to load or the app
  throws on startup, you get a panel saying what happened, a button to reset
  settings, and a button that dumps your raw notes as text to copy out.
- **`#reset`** on the end of the URL starts with standard settings, for when a
  setting makes the app unusable. It does not touch your notes.

## Developing

```
npm install                       # eslint + playwright
npx playwright install chromium
npm run check                     # lint, rebuild dist, run the tests
```

`npm test` drives a real Chromium against a served copy of the app: typing and
autosave, the note list, find, the menus and dialogs, every setting, the 4:3
fitter at five window sizes, and the whole of the safety behaviour above.
`node tests/run.js core safety` runs named suites. The Pages workflow runs
lint, build and tests before it will deploy, so a broken build cannot reach
the live site.

## Layout

```
index.html          markup for the machine and the window on its screen
css/chassis.css     the hardware: case, bezel, LEDs, keys, TrackPoint, ThinkLight
css/notepad.css     the software: bevelled chrome, menus, listbox, dialogs, print
css/themes.css      case finishes, desk surfaces, panel colours, the settings form
js/store.js         where notes live: per-note keys, the index, migration
js/ui.js            dialogs, menus and the status bar — no knowledge of notes
js/machine.js       the case: panel geometry, lights, ThinkLight, TrackPoint, sound
js/keyboard.js      the seven-row keyboard — builds it, mirrors real keystrokes
js/settings.js      the settings spec, its form, and migration of older preferences
js/app.js           the notes themselves, and what the commands do
build.js            folds all of the above into dist/thinkpad-notes.html
tests/              a static server, a browser, and seven suites
```

Load order matters and is fixed in `index.html`: `store`, `ui`, `settings`,
`keyboard`, `machine`, `app`. These are plain scripts on purpose — ES modules
cannot load over `file://`, and double-clicking the file has to keep working.

Each note is its own key, `thinkpad.note.<id>`, listed by `thinkpad.index.v2`;
settings live in `thinkpad.prefs.v1`. Saving a keystroke rewrites one note
rather than all of them. Notes and preferences written by older versions are
migrated on load — the old single-blob key is only dropped once the new copy
reads back correctly.

Exports use a plain download link when the page is opened from a file or a
server. When it runs somewhere that mediates saves — a sandboxed host — it
asks that host instead, so Export and Back Up work in both places.

## Reaching it from the keyboard

Every control takes focus and shows it. Menus open with `Alt`+their letter and
walk with the arrow keys — up and down the items, left and right between
menus, `Enter` to choose, `Esc` to leave. Dialogs keep Tab inside themselves
and hand focus back where it came from when they close. The status bar is an
`aria-live` region, so what it says is announced. All five colour schemes are
checked for contrast by the test suite, and `prefers-reduced-motion` stills
the pulsing lights.

## Not affiliated with anyone

An affectionate homage built from CSS. IBM, ThinkPad, TrackPoint and Access IBM
are trademarks of their respective owners; no association is claimed or implied.

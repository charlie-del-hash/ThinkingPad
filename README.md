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

- Note list with find-as-you-type, sorted by last edited
- Autosave (and `Ctrl+S` if you don't trust autosave — nobody does)
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
| **Machine** | Show the machine at all, keyboard, TrackPoint buttons, indicator lights, case finish (matte black / graphite / titanium), TrackPoint cap (cat's tongue / soft dome / eraser head), desk surface, panel shape, ThinkLight, screen glare, LCD grain, key click and its volume |
| **Screen** | Colour scheme (classic grey / warm paper / midnight / amber monochrome / green phosphor), typeface preset, interface face, note face, note size, line spacing, word wrap, tab width, spell check, status bar |
| **Notes** | Note list on or off, list on the left or right, list width, sort by last edited / created / title, date format, and whether opening the app resumes your last note or starts a blank one |
| **Data** | Back up everything to `.json`, restore from a backup, reset every setting, erase all notes — with a live count of notes, words and storage used |

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

## Layout

```
index.html          markup for the machine and the window on its screen
css/chassis.css     the hardware: case, bezel, LEDs, keys, TrackPoint, ThinkLight
css/notepad.css     the software: bevelled chrome, menus, listbox, dialogs, print
css/themes.css      case finishes, desk surfaces, panel colours, the settings form
js/settings.js      the settings spec, its form, and migration of older preferences
js/keyboard.js      the seven-row keyboard — builds it, mirrors real keystrokes
js/app.js           notes, storage, menus, dialogs, the 4:3 fitter, working hardware
build.js            folds all of the above into dist/thinkpad-notes.html
```

Storage keys: `thinkpad.notes.v1` (notes) and `thinkpad.prefs.v1` (every
setting). Preferences saved by an older version are migrated on load rather
than discarded.

Exports use a plain download link when the page is opened from a file or a
server. When it runs somewhere that mediates saves — a sandboxed host — it
asks that host instead, so Export and Back Up work in both places.

## Not affiliated with anyone

An affectionate homage built from CSS. IBM, ThinkPad, TrackPoint and Access IBM
are trademarks of their respective owners; no association is claimed or implied.

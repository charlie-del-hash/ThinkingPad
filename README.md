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
inside your window, on every resize — on a 1920x1080 display that's roughly
a 740x555 panel with the keyboard out, and 960x720 with it folded away
(**View > Keyboard**), which is about what a T-series actually ran.

## Two typefaces

| Mode | Chrome | Page | Why |
| --- | --- | --- | --- |
| **Period correct** (default) | Tahoma | Courier New | What a ThinkPad actually put on a screen around 2001 |
| **IBM Plex** | IBM Plex Sans | IBM Plex Mono | Gloriously anachronistic: IBM didn't draw Plex until 2017 |

Switch in **Format**, or click the typeface name in the status bar. The choice
is remembered. Plex is pulled from Google Fonts when you're online and falls
back to the period stack when you aren't, so the app works offline either way.

## Things on the machine that work

| Part | What it does |
| --- | --- |
| ThinkLight (the lamp above the screen) | Darkens the room and throws a warm cone over the keys. `Alt+L` |
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
| `Alt+F` `Alt+E` `Alt+O` `Alt+V` `Alt+H` | Open the menus |
| `Esc` | Close a menu or dialog |

`Ctrl+N` and `Ctrl+T` belong to the browser and can't be intercepted, which is
why New is `Alt+N`.

## Layout

```
index.html          markup for the machine and the window on its screen
css/chassis.css     the hardware: case, bezel, LEDs, keys, TrackPoint, ThinkLight
css/notepad.css     the software: bevelled chrome, menus, listbox, dialogs, print
js/keyboard.js      the seven-row keyboard — builds it, mirrors real keystrokes
js/app.js           notes, storage, menus, dialogs, the 4:3 fitter, working hardware
```

Storage keys: `thinkpad.notes.v1` (notes) and `thinkpad.prefs.v1` (typeface,
size, wrap, ThinkLight, glare, grain, sound, pane width).

## Not affiliated with anyone

An affectionate homage built from CSS. IBM, ThinkPad, TrackPoint and Access IBM
are trademarks of their respective owners; no association is claimed or implied.

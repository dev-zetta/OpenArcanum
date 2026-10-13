# Local reference game and reverse-engineering workflow

The **oracle** is the locally running original game, plus repeatable setup,
inputs, captures and observations. It is a source of evidence for OpenArcanum's
rules and presentation. It does not automatically decide whether a behavior is
correct, and it is not an Oracle database or Java product.

## Local installation

The October 12, 2026 workstation setup uses these private installations:

| Tool | Installed version | Verification |
| --- | --- | --- |
| Wine | 11.0 Staging, Fedora `11.0-3.fc44`, WoW64 | Official Fedora packages; all 57 downloaded RPM signatures passed. PE32 command prompt and Notepad executed. |
| Xvfb / xdotool | 21.1.24 / 3.20211022.1 | Private authenticated X display, input and screenshot smoke passed. |
| Ghidra | 12.1.4 | Official release ZIP size and SHA-256 matched GitHub release metadata. Supplied PE import, analysis and entry-point decompilation passed. |
| JDK | Eclipse Temurin 21.0.12.1+1 | Official release archive size and SHA-256 verified. Used by this Ghidra installation only. |

Sources: [Fedora Wine](https://packages.fedoraproject.org/pkgs/wine/wine-core/fedora-44.html),
[Ghidra release](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build),
[Temurin release](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1).
Ghidra's bundled release instructions specify JDK 21; a host JRE alone is insufficient.

Everything lives under ignored `local-data/tools/` and `local-data/reference/`.
No sudo, system package installation or system Java change is required. The
Wine bootstrap currently targets **Fedora 44 x86_64** and uses installed native
libraries; it is not a portable Wine distribution. Other hosts need an adapted
bootstrap. The engine's Windows/Linux/macOS targets are separate from this
Linux reference harness.

From the repository root:

```sh
bash scripts/oracle/install-wine.sh
python3 scripts/oracle/install-ghidra.py
scripts/oracle/wine.sh --version
scripts/oracle/ghidra.sh                 # opens Ghidra's GUI
```

Releases are pinned for reproducibility. Updating them is a deliberate tool
change, followed by a new execution/capture check. Provenance records under
`local-data/tools/{wine,ghidra,jdk}/` retain source URLs, versions and digests;
Wine also retains signature logs and package-level metadata. Interrupted Ghidra
extractions are preserved and retried through a staging directory.

The runner needs Python 3.12+, Pillow, `cp`, `xauth`, `xdpyinfo`, and ImageMagick
`import`. The manual converter needs Python 3.11+ and Poppler's `pdfinfo`,
`pdftotext` and `pdftoppm`. These dependencies are present on the tested host.

## Preserve and identify the supplied game

```sh
python3 scripts/oracle/oracle.py init --source ../Arcanum
python3 scripts/oracle/oracle.py verify-source
```

Initialization hashes every original file, creates an independent working copy
at `local-data/reference/oracle/game/`, and verifies the copy before changing
its configuration. It refuses an implicit overwrite. Reflinks may share storage,
but are copy-on-write; hard links are not used. Saves and configuration generated
by Wine belong to the working copy. The original source remains untouched.

The supplied installation contains **4,305 files** and three executable variants.
Its `Version.txt` reports 1.0.7.4 while its readme reports 1.0.6.4. Executable and
loose-file dates also differ. Treat it as a fingerprinted **user-supplied build**,
not an independently verified pristine retail release. Select a declared
compatibility profile before interpreting a difference as an engine bug.

Only the working-copy configuration is normalized: brightness 0, object lighting
on, shadows off, splash 0. `working-copy.json` records these values and executable
hashes; `source-manifest.json` records the original inventory. Also record any
later in-game option changes with a scenario. A post-run `verify-source` checks
that the original still matches the baseline.

## Launch, observe and capture

```sh
python3 scripts/oracle/oracle.py launch
python3 scripts/oracle/oracle.py capture menu --note 'Main menu after intro'
python3 scripts/oracle/oracle.py input --key Escape
python3 scripts/oracle/oracle.py input --key s
python3 scripts/oracle/oracle.py capture single-player
python3 scripts/oracle/oracle.py input --click 405 160
python3 scripts/oracle/oracle.py stop
python3 scripts/oracle/oracle.py verify-source
```

Observe the frame before choosing the next action; loading and movie duration
are not fixed waits. `s` opens Single Player from the main menu, and `n` opens
the new-game choice from its submenu. Input accepts xdotool key names/chords.
Clicks use 800×600 reference coordinates and hold the button long enough for
the original's frame-polled input. Matching Xvfb and Wine desktop dimensions
corrected cursor alignment; Single Player and New Game clicks were verified.
Check the resulting capture rather
than treating successful input submission as proof of a game action.

The verified launch sequence reached the crash site with predefined character
Merwin Tumblebrook and Virgil's opening dialogue. Captures are retained under
`local-data/reference/oracle/captures/`; the local `smoke-report.json` records
the evidence and remaining limits. This proves a reference-game startup path,
not a complete campaign run.

The default is `Arcanum.exe -no3d -doublebuffer` inside an 800×600 Wine virtual
desktop on its own 800×600 Xvfb display. A private Xauthority cookie protects the
display, and X TCP listening is disabled. Captures never read the user's desktop.
This is process/display separation, not a VM or filesystem security sandbox;
Wine still runs with the current user's filesystem permissions.

`--exe Arcanum-w.exe` and `--exe Arcanum_window.exe` select supplied variants and
record their own hashes. They are not interchangeable reference profiles.
The supplied primary executable's `-window` mode produced a blank client in the
tested virtual desktop; it is not the default. Audio fidelity, all executable
variants and full campaign stability have not been validated.

Each PNG gets JSON metadata with UTC time, SHA-256, dimensions, executable hash,
launch flags and session identity. Input goes to `actions.jsonl`. `wine.log` and
`xvfb.log` contain launch diagnostics. The Wine log retains errors and warnings
except high-volume DirectDraw/performance warnings; it does not enable trace
logging. Initial prefix setup produced OLE/setup/driver diagnostics. The final
gameplay launch logged a `wineboot` error for `winemenubuilder.exe`, which is
deliberately disabled to prevent desktop integration; no additional error-tagged
messages appeared during the observed startup and opening dialogue. A successful
frame is not a claim of an error-free Wine log. Loose-file lookup
warnings can be ordinary archive fallbacks; investigate observable failures.

`stop` kills and waits for only the dedicated Wine prefix, then terminates the
recorded Xvfb only if PID, start time, UID and command arguments still match.
It also works after a display crash. An existing session record must be cleaned
up before relaunch; no blanket `pkill wine` is used. Logs survive a stop but are
replaced on the next launch; retain a scenario's logs in a new private folder if
they need to accompany its captures.

## Compare matched scenes

Capture OpenArcanum separately with its existing local smoke command:

```sh
npm run smoke:game -- --show \
  --game-smoke-report=local-data/test-results/game.json \
  --game-screenshot=local-data/test-results/game.png
python3 scripts/oracle/oracle.py compare \
  local-data/reference/oracle/captures/REFERENCE.png \
  local-data/test-results/game.png \
  --reference-box 0 0 640 400 --implementation-box 0 0 640 400
```

Replace filenames and crop rectangles with observed, corresponding regions.
The comparator refuses unequal dimensions instead of rescaling original art.
It saves both crops, a difference image, source hashes, threshold, changed-pixel
fraction and mean RGB error. Differences above the default per-channel threshold
of 8 count as changed. These are visual aids, not a gameplay verdict.

Match map, actor position, camera, zoom, roof state, lighting, time, graphics
options and UI crop. Animated fire, cursor position and gamma can dominate a
pixel score. No matched Bates original-versus-OpenArcanum save/camera baseline
has been established yet; the existing engine smoke and reference launch are
separate checkpoints.

For each rules scenario, record an ID, manual page, executable/content hashes,
save/character setup, options, action sequence, expected observations, actual
outcome and known deviations. Prefer owned synthetic fixtures in public CI;
keep original saves, art, manual text and captured content private. Server-state
assertions must accompany client screenshots as authority moves to the server.

## Analyze executable copies with Ghidra

```sh
python3 scripts/oracle/oracle.py ghidra
scripts/oracle/ghidra.sh
```

The headless command imports the working-copy executable into an ignored Ghidra
project and runs `ExportOracleSummary.java`. It produces a program summary and
entry-point C pseudocode under `local-data/reference/oracle/analysis/`. Repeated
successful runs reuse the report; interrupted/failed attempts retain diagnostics
and can retry in a fresh project. Open the reported `.gpr` in the GUI for further
analysis; GUI settings, Java preferences, cache and temporary files stay local.

The primary supplied binary was identified as x86 little-endian PE32, Windows
compiler profile, image base `0x00400000`. Automatic analysis found **4,620
functions** and decompiled entry `0x00589f33`. Ghidra reported an invalid debug
directory pointer and an unrelated decompilation-flow warning; analysis and the
entry-point smoke still succeeded. Automatic function boundaries and recovered
names are leads, not verified behavior or proof that every function decompiles.

Start investigations from a reproducible observation and relevant imported
data/strings. Record executable hash, address/RVA, input structure, callers and
supporting traces before assigning meaning to a routine. Keep recovered code in
private analysis outputs; implement independently authored rules and document
observations in source. This workflow does not modify the original executable.

## Read and regenerate the manual

```sh
python3 scripts/oracle/convert-manual.py ../manual.pdf
# Reuse page images only when source hash, count and DPI still match:
python3 scripts/oracle/convert-manual.py ../manual.pdf --reuse-facsimiles
```

Open [searchable HTML](../local-data/reference/manual/manual.html) or
[Markdown](../local-data/reference/manual/manual.md). Both link one-based
**physical PDF pages** through `page-001` … `page-187`; printed page labels can
differ. The [pitch](GAME_PITCH.md) and [roadmap](FEATURE_ROADMAP.md) use these
physical-page references.

This supplied PDF includes rotated printer spreads and crop boxes. Raw
`pdftotext` repeats hidden neighboring content, so the converter uses visible
word geometry before reflowing paragraphs. The conversion retained 51,490
visible PDF words across 187 pages, reconstructed 34 shortcut rows and preserved
all 187 original-page images. Raster spell tables, illustrations and decorative
drop capitals remain in facsimiles; no guessed OCR is inserted. An extraction
manifest records source/output hashes, page counts and text accounting. The
source PDF is never modified. Static HTML structure and source/image samples
were checked; live browser interaction has not been verified.

Converted manual content and its page images remain ignored local reference
material. Only the reusable conversion script and our authored design documents
belong to the source publication.

## Harness checks

```sh
python3 -m unittest discover -s scripts/oracle -p 'test_*.py'
python3 -m py_compile scripts/oracle/*.py
for oracle_script in scripts/oracle/*.sh; do bash -n "$oracle_script" || break; done
```

These checks complement real Wine execution, captured reference screens and
Ghidra import/decompilation. They do not establish campaign compatibility or
complete reverse-engineering coverage.

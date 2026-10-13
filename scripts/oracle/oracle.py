#!/usr/bin/env python3
"""Local original-game reference runner, evidence capture and image comparison."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / 'local-data/reference/oracle'
GAME = STATE / 'game'
SCRIPTS = Path(__file__).resolve().parent
PREFIX = ROOT / 'local-data/reference/wineprefix'
EXECUTABLES = ('Arcanum.exe', 'Arcanum-w.exe', 'Arcanum_window.exe')


def now():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inventory(directory):
    files = []
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Original-game inventory does not follow symlinks: {path}')
        if path.is_file():
            files.append(dict(path=str(path.relative_to(directory)), size=path.stat().st_size, sha256=sha(path)))
    return files


def init(args):
    source = args.source.resolve()
    if GAME.exists() or (STATE / 'source-manifest.json').exists():
        raise ValueError('Reference copy already exists; use verify-source, never overwrite it implicitly')
    if not (source / 'Arcanum.exe').is_file() or source.is_relative_to(STATE) or STATE.is_relative_to(source):
        raise ValueError('Expected the supplied original-game directory, outside the oracle working copy')
    before = inventory(source)
    STATE.mkdir(parents=True, exist_ok=True)
    subprocess.run(['cp', '-a', '--reflink=auto', '--', str(source), str(GAME)], check=True)
    if inventory(GAME) != before:
        raise RuntimeError('Working copy does not match the original')
    manifest = dict(source=str(source), recordedAt=now(), files=before,
                    versionFile=(source / 'Version.txt').read_text(errors='replace').strip(),
                    status='User-supplied build; not independently verified as an unmodified retail release')
    save(STATE / 'source-manifest.json', manifest)
    # Normalize only the disposable comparison copy. Gamma/object-lighting
    # differences otherwise make apparently identical lighting incomparable.
    configuration = GAME / 'arcanum.cfg'
    settings = {'brightness': '0', 'object lighting': '1', 'shadows': '0', 'splash': '0'}
    lines = configuration.read_text(encoding='latin1').splitlines() if configuration.exists() else []
    output = []
    for line in lines:
        key = line.split('=', 1)[0].strip()
        if key in settings:
            output.append(f'{key}={settings.pop(key)}')
        else:
            output.append(line)
    output.extend(f'{key}={value}' for key, value in settings.items())
    configuration.write_text('\n'.join(output) + '\n', encoding='latin1')
    save(STATE / 'working-copy.json', dict(createdAt=now(), sourceManifest='source-manifest.json',
         normalizedSettings={'brightness': 0, 'object lighting': 1, 'shadows': 0, 'splash': 0},
         executables={name: sha(GAME / name) for name in EXECUTABLES if (GAME / name).is_file()}))
    return dict(workingCopy=str(GAME), originalFiles=len(before), sourcePreserved=inventory(source) == before)


def verify_source(_args):
    manifest = json.loads((STATE / 'source-manifest.json').read_text())
    actual = inventory(Path(manifest['source']))
    expected = {f['path']: f for f in manifest['files']}
    current = {f['path']: f for f in actual}
    changes = [name for name in sorted(expected.keys() | current.keys()) if expected.get(name) != current.get(name)]
    result = dict(ok=not changes, checkedAt=now(), files=len(actual), changed=changes)
    save(STATE / 'source-verification.json', result)
    if changes:
        raise RuntimeError(f'Original game changed: {changes}')
    return result


def process_identity(pid):
    try:
        process = Path(f'/proc/{pid}')
        # stat's command name can contain spaces and parentheses.
        started = process.joinpath('stat').read_text().rsplit(')', 1)[1].split()[19]
        arguments = process.joinpath('cmdline').read_bytes().split(b'\0')
        return dict(started=started, uid=process.stat().st_uid,
                    arguments=[item.decode(errors='replace') for item in arguments if item])
    except (FileNotFoundError, ProcessLookupError):
        return None


def owned_display(state):
    identity = process_identity(state.get('xvfbPid', 0))
    return identity is not None and identity == state.get('xvfbIdentity') and identity['uid'] == os.getuid()


def load_state():
    return json.loads((STATE / 'session.json').read_text())


def run_state():
    state = load_state()
    if not owned_display(state):
        raise RuntimeError('The recorded oracle display is no longer running')
    return state


def session_env(state):
    return {**os.environ, 'DISPLAY': state['display'], 'XAUTHORITY': state['authority'],
            'WINEPREFIX': str(PREFIX), 'WINEDLLOVERRIDES': 'winemenubuilder.exe=;mscoree,mshtml=',
            'WINEDEBUG': '-all,+timestamp,+pid,err+all,warn+all,warn-ddraw,warn-d3d_perf'}


def launch(args):
    if not (STATE / 'working-copy.json').exists():
        raise ValueError('Run init before launching the original game')
    prior = STATE / 'session.json'
    if prior.exists():
        raise ValueError('An oracle session is recorded; run stop before launching another, even after a crash')
    executable = GAME / args.exe
    if not executable.is_file():
        raise ValueError(f'Supplied variant is missing: {args.exe}')
    for name in ('wine.sh', 'xvfb.sh', 'xdotool.sh'):
        if not os.access(SCRIPTS / name, os.X_OK):
            raise ValueError('Run scripts/oracle/install-wine.sh first')
    display_number = next((n for n in range(90, 190) if not Path(f'/tmp/.X11-unix/X{n}').exists()
                           and not Path(f'/tmp/.X{n}-lock').exists()), None)
    if display_number is None:
        raise RuntimeError('No free oracle display number')
    display = f':{display_number}'
    authority = STATE / 'Xauthority'
    authority.touch(mode=0o600, exist_ok=True)
    authority.chmod(0o600)
    subprocess.run(['xauth', '-f', str(authority), 'add', display, '.', secrets.token_hex(16)], check=True)
    log = (STATE / 'xvfb.log').open('w')
    display_process = subprocess.Popen([str(SCRIPTS / 'xvfb.sh'), display, '-screen', '0', '800x600x24',
                         '-nolisten', 'tcp', '-auth', str(authority), '-noreset'],
                         stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    log.close()
    state = dict(startedAt=now(), display=display, authority=str(authority), xvfbPid=display_process.pid,
                 executable=args.exe, executableSHA256=sha(executable), winePrefix=str(PREFIX),
                 desktop='OpenArcanumOracle', gameSize=[800, 600], flags=['-no3d', '-doublebuffer'])
    env = session_env(state)
    try:
        for _ in range(50):
            if display_process.poll() is not None:
                raise RuntimeError('Oracle Xvfb exited; inspect xvfb.log')
            ready = subprocess.run(['xdpyinfo', '-display', display], env=env, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL).returncode == 0
            if ready:
                break
            time.sleep(0.1)
        else:
            raise RuntimeError('Oracle Xvfb did not become ready')
        state['xvfbIdentity'] = process_identity(display_process.pid)
        log = (STATE / 'wine.log').open('w')
        game_process = subprocess.Popen([str(SCRIPTS / 'wine.sh'), 'explorer',
                            '/desktop=OpenArcanumOracle,800x600', str(executable), *state['flags']],
                            cwd=GAME, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        log.close()
        state['winePid'] = game_process.pid
        save(prior, state)
        return state
    except BaseException:
        display_process.terminate()
        raise


def oracle_window(state):
    result = subprocess.run([str(SCRIPTS / 'xdotool.sh'), 'search', '--onlyvisible', '--name',
                             'OpenArcanumOracle'], env=session_env(state), capture_output=True, text=True)
    return result.stdout.splitlines()[-1] if result.returncode == 0 and result.stdout.strip() else 'root'


def capture(args):
    if not re.fullmatch(r'[A-Za-z0-9_-]+', args.label):
        raise ValueError('Capture label may contain only letters, numbers, dash and underscore')
    state = run_state()
    directory = STATE / 'captures'
    directory.mkdir(exist_ok=True)
    stem = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + args.label
    path = directory / (stem + '.png')
    window = oracle_window(state)
    subprocess.run(['import', '-display', state['display'], '-window', window, str(path)],
                   env=session_env(state), check=True)
    from PIL import Image
    with Image.open(path) as image:
        size = list(image.size)
    record = dict(capturedAt=now(), screenshot=str(path), sha256=sha(path), size=size,
                  window=window, session=state, note=args.note or 'Unclassified reference capture')
    save(directory / (stem + '.json'), record)
    return record


def input_event(args):
    state = run_state()
    tool = str(SCRIPTS / 'xdotool.sh')
    if args.key:
        if not re.fullmatch(r'[A-Za-z0-9_+]+', args.key):
            raise ValueError('Expected an xdotool key name or chord')
        command = [tool, 'key', '--clearmodifiers', '--delay', '120', args.key]
    else:
        x, y = args.click
        if not (0 <= x < 800 and 0 <= y < 600):
            raise ValueError('Click coordinates must be inside the 800x600 oracle desktop')
        window = oracle_window(state)
        subprocess.run([tool, 'mousemove', '--window', window, str(x), str(y)], env=session_env(state), check=True)
        # The original polls mouse state each frame; an immediate down/up pair
        # can vanish between polls, especially during software rendering.
        time.sleep(0.12)
        subprocess.run([tool, 'mousedown', '1'], env=session_env(state), check=True)
        time.sleep(0.12)
        command = [tool, 'mouseup', '1']
    subprocess.run(command, env=session_env(state), check=True)
    with (STATE / 'actions.jsonl').open('a') as stream:
        stream.write(json.dumps(dict(at=now(), key=args.key, click=args.click)) + '\n')
    return dict(ok=True, key=args.key, click=args.click)


def stop(_args):
    state = load_state()
    # The wrapper's server switch is scoped to this explicitly recorded prefix.
    subprocess.run([str(SCRIPTS / 'wine.sh'), '--server', '-k'], env=session_env(state), check=True)
    subprocess.run([str(SCRIPTS / 'wine.sh'), '--server', '-w'], env=session_env(state), check=True)
    if owned_display(state):
        os.kill(state['xvfbPid'], signal.SIGTERM)
    state['stoppedAt'] = now()
    save(STATE / 'last-session.json', state)
    (STATE / 'session.json').unlink()
    return dict(ok=True, stoppedAt=state['stoppedAt'])


def ghidra(args):
    executable = GAME / args.exe
    if not executable.is_file():
        raise ValueError('Run init first; Ghidra imports the working copy')
    projects = STATE / 'ghidra-projects'
    projects.mkdir(exist_ok=True)
    digest = sha(executable)
    name = executable.stem + '-' + digest[:12]
    output = STATE / 'analysis' / name
    project = 'Arcanum-' + digest[:12]
    candidates = [output, *sorted(output.parent.glob(name + '-*'), reverse=True)]
    for candidate in candidates:
        report = candidate / 'program-summary.json'
        candidate_project = project + candidate.name[len(name):]
        if report.is_file() and (projects / (candidate_project + '.gpr')).is_file():
            try:
                summary = json.loads(report.read_text())
            except (OSError, json.JSONDecodeError):
                continue
            if summary.get('sha256') == digest and summary.get('functions') and any(
                    e.get('decompiled') and (candidate / e.get('file', '')).is_file()
                    for e in summary.get('entryPoints', [])):
                return dict(project=str(projects / (candidate_project + '.gpr')), output=str(candidate),
                            summary=summary, reused=True)
    if output.exists() or (projects / (project + '.gpr')).exists():
        # Keep diagnostics from failed/interrupted imports and retry in a new project.
        attempt = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        output = STATE / 'analysis' / (name + '-' + attempt)
        project += '-' + attempt
    output.mkdir(parents=True)
    command = [str(SCRIPTS / 'ghidra.sh'), '--headless', str(projects), project,
               '-import', str(executable), '-analysisTimeoutPerFile', '300', '-max-cpu', '2',
               '-scriptPath', str(SCRIPTS), '-postScript', 'ExportOracleSummary.java', str(output),
               '-log', str(output / 'analysis.log'), '-scriptlog', str(output / 'scripts.log')]
    with (output / 'console.log').open('w') as log:
        subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, check=True)
    summary = json.loads((output / 'program-summary.json').read_text())
    if not summary['functions'] or not any(e.get('decompiled') for e in summary['entryPoints']):
        raise RuntimeError('Ghidra import did not establish a working analyzer/decompiler')
    return dict(project=str(projects / (project + '.gpr')), output=str(output), summary=summary)


def compare(args):
    from PIL import Image, ImageChops, ImageStat
    reference, implementation = args.reference.resolve(), args.implementation.resolve()
    with Image.open(reference) as original, Image.open(implementation) as candidate:
        a, b = original.convert('RGB'), candidate.convert('RGB')
    for name, box in [('reference', args.reference_box), ('implementation', args.implementation_box)]:
        if box:
            image = a if name == 'reference' else b
            x, y, width, height = box
            if min(x, y) < 0 or width <= 0 or height <= 0 or x + width > image.width or y + height > image.height:
                raise ValueError(f'Invalid {name} crop')
            cropped = image.crop((x, y, x + width, y + height))
            if name == 'reference': a = cropped
            else: b = cropped
    if a.size != b.size:
        raise ValueError('Image sizes differ; specify matched crops instead of silently scaling artwork')
    difference = ImageChops.difference(a, b)
    red, green, blue = difference.split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    changed = maximum.point(lambda value: 255 if value > args.threshold else 0).histogram()[255]
    directory = STATE / 'comparisons' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    directory.mkdir(parents=True)
    difference.save(directory / 'difference.png')
    a.save(directory / 'reference.png')
    b.save(directory / 'implementation.png')
    result = dict(createdAt=now(), reference=str(reference), implementation=str(implementation),
                  referenceSHA256=sha(reference), implementationSHA256=sha(implementation),
                  referenceBox=args.reference_box, implementationBox=args.implementation_box,
                  size=list(a.size), threshold=args.threshold, changedPixels=changed,
                  changedFraction=changed / (a.width * a.height), meanAbsoluteRGBError=ImageStat.Stat(difference).mean,
                  output=str(directory), note='Visual difference aid, not a behavioral correctness verdict')
    save(directory / 'comparison.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    command = commands.add_parser('init', help='Fingerprint original files and make an independent working copy')
    command.add_argument('--source', type=Path, default=ROOT.parent / 'Arcanum')
    commands.add_parser('verify-source', help='Verify that the supplied original has not changed')
    command = commands.add_parser('launch', help='Launch the working copy in its private Wine/Xvfb desktop')
    command.add_argument('--exe', choices=EXECUTABLES, default='Arcanum.exe')
    command = commands.add_parser('capture', help='Capture only the private reference-game desktop')
    command.add_argument('label')
    command.add_argument('--note')
    command = commands.add_parser('input', help='Send input only to the private reference display')
    group = command.add_mutually_exclusive_group(required=True)
    group.add_argument('--key')
    group.add_argument('--click', nargs=2, type=int, metavar=('X', 'Y'))
    commands.add_parser('stop', help='Stop only the oracle Wine prefix and owned Xvfb')
    command = commands.add_parser('ghidra', help='Import/analyze a working-copy executable and verify decompilation')
    command.add_argument('--exe', choices=EXECUTABLES, default='Arcanum.exe')
    command = commands.add_parser('compare', help='Compare matched screenshots/crops without rescaling')
    command.add_argument('reference', type=Path)
    command.add_argument('implementation', type=Path)
    command.add_argument('--reference-box', nargs=4, type=int, metavar=('X', 'Y', 'W', 'H'))
    command.add_argument('--implementation-box', nargs=4, type=int, metavar=('X', 'Y', 'W', 'H'))
    command.add_argument('--threshold', type=int, default=8)
    args = parser.parse_args()
    handlers = {'init': init, 'verify-source': verify_source, 'launch': launch, 'capture': capture,
                'input': input_event, 'stop': stop, 'ghidra': ghidra, 'compare': compare}
    if args.command == 'compare' and not 0 <= args.threshold <= 255:
        parser.error('Threshold must be in 0..255')
    try:
        print(json.dumps(handlers[args.command](args), indent=2))
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f'Oracle: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

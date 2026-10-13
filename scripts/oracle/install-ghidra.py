#!/usr/bin/env python3
"""Install pinned official Ghidra and Temurin JDK distributions inside local-data."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / 'local-data/tools'
DOWNLOADS = TOOLS / 'downloads'


def fetch(url, destination):
    subprocess.run(['curl', '--fail', '--location', '--retry', '3', '--silent',
                    '--show-error', url, '-o', str(destination)], check=True)


REQUIRED_FILES = {
    'ghidra': (('Ghidra/application.properties', False), ('support/analyzeHeadless', True),
               ('support/launch.properties', False), ('support/launch.sh', True)),
    'jdk': (('bin/java', True), ('bin/javac', True)),
}


def installation_ready(directory, kind):
    return directory.is_dir() and not directory.is_symlink() and all(
        (directory / name).is_file() and (directory / name).stat().st_size > 0
        and (not executable or os.access(directory / name, os.X_OK))
        for name, executable in REQUIRED_FILES[kind])


def archive_directory(names):
    paths = [PurePosixPath(name) for name in names]
    if not paths or any(path.is_absolute() or '..' in path.parts or not path.parts for path in paths):
        raise RuntimeError('Unsafe release archive paths')
    roots = {path.parts[0] for path in paths}
    if len(roots) != 1:
        raise RuntimeError('Expected one top-level release directory')
    return roots.pop()


def preserve_incomplete(path):
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    saved = path.with_name(f'{path.name}.failed-{timestamp}')
    path.rename(saved)
    return saved


def extract_release(archive, destination, kind):
    """Promote a validated extraction atomically; retain interrupted attempts."""
    opener = zipfile.ZipFile if archive.suffix == '.zip' else tarfile.open
    with opener(archive) as compressed:
        names = compressed.namelist() if isinstance(compressed, zipfile.ZipFile) else compressed.getnames()
        directory = archive_directory(names)
        installed = destination / directory
        if installation_ready(installed, kind):
            return installed
        staging = Path(tempfile.mkdtemp(prefix=f'.{directory}.staging-', dir=destination))
        try:
            if isinstance(compressed, zipfile.ZipFile):
                compressed.extractall(staging)
                for entry in compressed.infolist():
                    mode = (entry.external_attr >> 16) & 0o777
                    if mode:
                        (staging / entry.filename).chmod(mode)
            else:
                compressed.extractall(staging, filter='data')
            extracted = staging / directory
            if not installation_ready(extracted, kind):
                raise RuntimeError(f'Incomplete {kind} release: required entrypoints are missing or unusable')
            if installed.exists() or installed.is_symlink():
                preserve_incomplete(installed)
            extracted.rename(installed)
            staging.rmdir()
        except BaseException:
            if staging.exists():
                preserve_incomplete(staging)
            raise
    return installed


def install(repository, tag, kind, predicate):
    metadata = DOWNLOADS / f'{kind}-release.json'
    fetch(f'https://api.github.com/repos/{repository}/releases/tags/{tag}', metadata)
    release = json.loads(metadata.read_text())
    asset = next(a for a in release['assets'] if predicate(a['name']))
    archive = DOWNLOADS / asset['name']
    digest = asset.get('digest', '')
    if not digest.startswith('sha256:'):
        raise RuntimeError('The official release has no SHA-256 asset digest')
    expected = digest.split(':', 1)[1]
    if not archive.exists():
        temporary = archive.with_suffix(archive.suffix + '.partial')
        fetch(asset['browser_download_url'], temporary)
        temporary.rename(archive)
    with archive.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected or archive.stat().st_size != asset['size']:
        raise RuntimeError(f'Release integrity mismatch: {archive.name}')
    destination = TOOLS / kind
    destination.mkdir(exist_ok=True)
    installed = extract_release(archive, destination, kind)
    directory = installed.name
    provenance = dict(version=tag, url=asset['browser_download_url'], sha256=actual,
                      release=release['html_url'], directory=directory)
    (destination / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    return installed


def main():
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    ghidra = install('NationalSecurityAgency/ghidra', 'Ghidra_12.1.4_build', 'ghidra',
                     lambda name: name.startswith('ghidra_') and name.endswith('.zip'))
    jdk = install('adoptium/temurin21-binaries', 'jdk-21.0.12.1+1', 'jdk',
                  lambda name: name.startswith('OpenJDK21U-jdk_x64_linux_hotspot_') and name.endswith('.tar.gz'))
    state = ROOT / 'local-data/reference/oracle'
    properties = ghidra / 'support/launch.properties'
    text = properties.read_text()
    # These are settings of this private installation, not system Java settings.
    lines = [line for line in text.splitlines() if not line.startswith('JAVA_HOME_OVERRIDE=')
             and not any(line.startswith(f'VMARGS=-D{key}=') for key in
                         ('application.settingsdir', 'application.cachedir', 'application.tempdir',
                          'java.util.prefs.userRoot'))]
    lines.append(f'JAVA_HOME_OVERRIDE={jdk}')
    for key, name in [('application.settingsdir', 'ghidra-settings'),
                      ('application.cachedir', 'ghidra-cache'), ('application.tempdir', 'ghidra-tmp'),
                      ('java.util.prefs.userRoot', 'java-prefs')]:
        directory = state / name
        directory.mkdir(parents=True, exist_ok=True)
        lines.append(f'VMARGS=-D{key}={directory}')
    properties.write_text('\n'.join(lines) + '\n')
    print(json.dumps(dict(ghidra=str(ghidra), jdk=str(jdk)), indent=2))


if __name__ == '__main__':
    main()

#!/usr/bin/env bash
# Extract signed official Fedora packages locally; no sudo, RPM installation or scriptlets.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
tool_dir="$project_dir/local-data/tools/wine"
if [[ "$(rpm -E '%fedora')" != 44 || "$(uname -m)" != x86_64 ]]; then
  printf '%s\n' 'This bootstrap targets Fedora 44 x86_64 and uses its installed native dependencies.' >&2
  exit 1
fi
mkdir -p -- "$tool_dir"/{packages,cache,state,logs,root,bin}
dnf_args=(--setopt="cachedir=$tool_dir/cache" --setopt="persistdir=$tool_dir/state"
  --setopt="logdir=$tool_dir/logs" --setopt=keepcache=True
  --disable-repo='*' --enable-repo=fedora --enable-repo=updates)
dnf5 "${dnf_args[@]}" download --resolve --destdir="$tool_dir/packages" \
  wine-core-11.0-3.fc44.x86_64 wine-common-11.0-3.fc44.noarch \
  wine-pulseaudio-11.0-3.fc44.x86_64 wine-alsa-11.0-3.fc44.x86_64 \
  xorg-x11-server-Xvfb-21.1.24-1.fc44.x86_64 xdotool-3.20211022.1-10.fc44.x86_64 \
  > "$tool_dir/logs/download.log" 2>&1
rpmkeys --checksig "$tool_dir"/packages/*.rpm > "$tool_dir/logs/rpm-signatures.log" 2>&1
if rg -q 'NOT OK|NOKEY|NOTTRUSTED|BAD|MISSING' "$tool_dir/logs/rpm-signatures.log"; then
  cat "$tool_dir/logs/rpm-signatures.log" >&2
  exit 1
fi
for package_file in "$tool_dir"/packages/*.rpm; do
  (cd -- "$tool_dir/root" && rpm2cpio "$package_file" | cpio -idmu --no-absolute-filenames --quiet)
done
# Fedora normally creates these through alternatives RPM scriptlets. Keep them local.
ln -sfn wine64 "$tool_dir/root/usr/bin/wine"
ln -sfn wineserver64 "$tool_dir/root/usr/bin/wineserver"
for architecture in i386-windows x86_64-windows; do
  builtin_dir="$tool_dir/root/usr/lib64/wine-wow64/wine/$architecture"
  for dll in dxgi d3d8 d3d9 d3d10core d3d10 d3d10_1 d3d11; do
    [[ ! -f "$builtin_dir/wine-$dll.dll" ]] || ln -sfn "wine-$dll.dll" "$builtin_dir/$dll.dll"
  done
done
for name in wine xvfb xdotool; do
  ln -sfn "$project_dir/scripts/oracle/$name.sh" "$tool_dir/bin/$name"
done
mapfile -t package_specs < <(rpm -qp --qf '%{NAME}-%{VERSION}-%{RELEASE}.%{ARCH}\n' "$tool_dir"/packages/*.rpm)
dnf5 "${dnf_args[@]}" --cacheonly repoquery \
  --queryformat=$'%{full_nevra}\t%{repoid}\t%{location}\n' "${package_specs[@]}" \
  > "$tool_dir/logs/package-urls.tsv" 2> "$tool_dir/logs/package-urls.log"
python3 - "$tool_dir" <<'PY'
import datetime, hashlib, json, pathlib, subprocess, sys
tool = pathlib.Path(sys.argv[1])
packages = []
for package in sorted((tool / 'packages').glob('*.rpm')):
    fields = subprocess.check_output(['rpm', '-qp', '--qf',
        '%{NAME}\n%{VERSION}\n%{RELEASE}\n%{ARCH}\n%{VENDOR}\n%{LICENSE}\n%{SOURCERPM}\n', str(package)], text=True).splitlines()
    packages.append(dict(zip(['name', 'version', 'release', 'arch', 'vendor', 'license', 'source_rpm'], fields)) |
        {'file': package.name, 'sha256': hashlib.file_digest(package.open('rb'), 'sha256').hexdigest(), 'bytes': package.stat().st_size})
manifest = {
    'recorded_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'host': pathlib.Path('/etc/os-release').read_text(),
    'method': 'dnf5 download --resolve from official fedora/updates; rpmkeys verification; raw rpm2cpio extraction, no scriptlets',
    'native_dependencies': 'Uses already installed Fedora native libraries; not a self-contained distribution for other hosts.',
    'signature_log': 'logs/rpm-signatures.log',
    'repository_urls': 'logs/package-urls.tsv',
    'primary_sources': ['https://packages.fedoraproject.org/pkgs/wine/wine-core/fedora-44.html',
        'https://packages.fedoraproject.org/pkgs/xorg-x11-server/xorg-x11-server-Xvfb/',
        'https://packages.fedoraproject.org/pkgs/xdotool/xdotool/'],
    'packages': packages,
}
(tool / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
PY
"$project_dir/scripts/oracle/wine.sh" --version
printf '%s\n' "Installed local tools and provenance at $tool_dir"

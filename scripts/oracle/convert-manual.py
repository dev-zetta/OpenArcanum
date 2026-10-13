#!/usr/bin/env python3
"""Convert a local, user-supplied PDF to private, navigable Markdown/HTML.

Only Python's standard library and Poppler's pdfinfo/pdftotext/pdftoppm are
required. No network requests, OCR, or PDF modifications are performed. Text
and rendered page images go under ignored local-data, never into source files.

Example:
    python3 scripts/oracle/convert-manual.py ../manual.pdf

Rotated, cropped printer spreads require special care: pdftotext -cropbox
still emits text outside the visible crop. This converter filters individual
word boxes against the rotated CropBox before reflowing paragraphs. Every
visible extracted word is accounted for; full-page facsimiles preserve raster
tables, illustrations and decorative letters that have no PDF text layer.
"""

import argparse
import collections
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


NS = {"h": "http://www.w3.org/1999/xhtml"}
MAJOR = re.compile(r"^(?:Chapter\s+\d+:|Section\s+\d+-\d+[:.]|A-\d+\s*:|Preface\b|Customer Support\b)", re.I)
LIST = re.compile(r"^(?:\d+[.)]|[a-z][.)]|[ivxlcdm]+[.)]|[•\u2022-])\s+", re.I)
FOOTER = re.compile(r"^(?:\d+\s*[–-]\s*Arcanum Players Guide|Arcanum Players Guide\s*[–-]\s*\d+)$")


def run(arguments):
    return subprocess.run(arguments, check=True, capture_output=True, text=True).stdout


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def canonical(text):
    # Only remove line-wrap hyphens followed by a lower-case continuation.
    return re.sub(r"\s+", "", re.sub(r"(?<=[A-Za-z])-\s+(?=[a-z])", "", text))


def reflow(lines):
    return re.sub(r"(?<=[A-Za-z])-\s+(?=[a-z])", "", " ".join(lines)).strip()


def md_text(text):
    return re.sub(r"([\\`*_\[\]<>])", r"\\\1", text)


def page_info(source):
    basic = run(["pdfinfo", str(source)])
    count_match = re.search(r"^Pages:\s+(\d+)$", basic, re.M)
    if not count_match:
        raise ValueError("pdfinfo did not return a page count")
    count = int(count_match.group(1))
    detailed = run(["pdfinfo", "-f", "1", "-l", str(count), "-box", str(source)])
    rotations = {int(page): int(rotation) for page, rotation in
                 re.findall(r"Page\s+(\d+) rot:\s+(\d+)", detailed)}
    if count == 1 and not rotations:
        rotations[1] = int(re.search(r"Page rot:\s+(\d+)", detailed).group(1))
    return count, rotations, basic, detailed


def line_text(words):
    return " ".join(word["text"] for word in words)


def laid_out(lines, page_width):
    # Preserve column alignment without pretending that artwork has a text layer.
    result = []
    last_y = None
    rows = []
    for words in sorted(lines, key=lambda line: min(word["y"] for word in line)):
        y = min(word["y"] for word in words)
        if rows and abs(rows[-1][0] - y) < 2:
            rows[-1][1].extend(words)
        else:
            rows.append([y, words[:]])
    for _, words in rows:
        y = min(word["y"] for word in words)
        if last_y is not None and y - last_y > 20:
            result.append("")
        row = ""
        for word in sorted(words, key=lambda item: item["x"]):
            column = round(word["x"] / page_width * 100)
            row += " " * max(1 if row else 0, column - len(row)) + word["text"]
        result.append(row.rstrip())
        last_y = y
    return "\n".join(result)


def classify_block(lines, body_height, page_width):
    nodes = []
    paragraph = []

    def flush():
        if paragraph:
            nodes.append({"kind": "paragraph", "text": reflow(paragraph), "source_text": " ".join(paragraph)})
            paragraph.clear()

    # Tables encoded as aligned text retain that alignment in a preformatted
    # block. Raster tables are preserved by the original-page image instead.
    split_rows = sum(any(b["x"] - a["right"] > 25 for a, b in zip(line, line[1:]))
                     for line in lines)
    if len(lines) >= 2 and split_rows >= 2:
        return [{"kind": "layout", "text": laid_out(lines, page_width),
                 "source_text": " ".join(line_text(line) for line in lines)}]
    for words in lines:
        text = line_text(words)
        height = statistics.median(word["height"] for word in words)
        heading = MAJOR.match(text) or (not paragraph and len(text) < 80 and len(words) <= 8 and height > body_height * 1.14)
        if FOOTER.match(text):
            flush()
            nodes.append({"kind": "footer", "text": text})
        elif heading and not text.startswith("Figure "):
            flush()
            nodes.append({"kind": "heading", "text": text, "major": bool(MAJOR.match(text)), "font_height": height})
        elif LIST.match(text):
            flush()
            nodes.append({"kind": "list", "text": text, "source_text": text})
        elif nodes and nodes[-1]["kind"] == "list" and not paragraph:
            # Lines within the same PDF block continue the preceding list item.
            nodes[-1]["source_text"] += " " + text
            nodes[-1]["text"] = reflow([nodes[-1]["text"], text])
        else:
            paragraph.append(text)
    flush()
    return nodes


def shortcut_table(blocks):
    """Reassemble geometric key/action rows even when PDF flow splits columns."""
    lines = [line for block in blocks for line in block]
    key_lines = [line for line in lines if re.match(r"^<[^>]+>", line_text(line))]
    if len(key_lines) < 4:
        return None
    top = min(min(word["y"] for word in line) for line in key_lines) - 2
    bottom = max(max(word["y"] + word["height"] for word in line) for line in key_lines)
    # Continuations between the final key and the footer belong to its action.
    lower_lines = [line for line in lines if min(word["y"] for word in line) >= top and
                   not FOOTER.match(line_text(line))]
    bottom = max(max(word["y"] + word["height"] for word in line) for line in lower_lines)
    rows = []
    for line in sorted(lower_lines, key=lambda item: min(word["y"] for word in item)):
        y = min(word["y"] for word in line)
        if rows and abs(rows[-1][0] - y) < 2:
            rows[-1][1].extend(line)
        else:
            rows.append([y, line[:]])
    entries = []
    for _, words in rows:
        text = line_text(sorted(words, key=lambda item: item["x"]))
        match = re.match(r"^(<[^>]+>)\s*(.*)", text)
        if match:
            entries.append([match.group(1), match.group(2)])
        elif entries:
            entries[-1][1] = reflow([entries[-1][1], text])
        else:
            return None
    selected = [word for line in lower_lines for word in line]
    return {"top": top, "bottom": bottom,
            "node": {"kind": "table", "rows": entries,
                     "text": "\n".join(key + " " + action for key, action in entries),
                     "source_text": " ".join(word["text"] for word in selected)}}


def join_title_lines(nodes):
    result = []
    for node in nodes:
        previous = result[-1] if result else None
        if (previous and previous["kind"] == "heading" and previous.get("major") and
                node["kind"] == "heading" and not node.get("major") and
                node["font_height"] >= previous["font_height"] * .9):
            previous["text"] += " " + node["text"]
            previous["font_height"] = max(previous["font_height"], node["font_height"])
        else:
            result.append(node)
    return result


def extract_pages(xml_path, rotations):
    root = ET.parse(xml_path).getroot()
    result = []
    for number, page in enumerate(root.findall(".//h:page", NS), 1):
        width, height = float(page.get("width")), float(page.get("height"))
        if rotations.get(number, 0) % 180:
            width, height = height, width
        blocks = []
        accepted = []
        excluded = 0
        for block in page.findall(".//h:block", NS):
            lines = []
            for line in block.findall("h:line", NS):
                words = []
                for element in line.findall("h:word", NS):
                    left, top, right, bottom = (float(element.get(key)) for key in
                                                ("xMin", "yMin", "xMax", "yMax"))
                    if not (0 <= (left + right) / 2 < width and
                            0 <= (top + bottom) / 2 < height):
                        excluded += 1
                        continue
                    word = {"text": element.text or "", "x": left, "y": top,
                            "right": right, "height": bottom - top}
                    words.append(word)
                    accepted.append(word)
                if words:
                    lines.append(words)
            if lines:
                blocks.append(lines)
        body_height = statistics.median(word["height"] for word in accepted) if accepted else 10
        table = shortcut_table(blocks)
        if table:
            above, below = [], []
            for block in blocks:
                upper = [line for line in block if min(word["y"] for word in line) < table["top"]]
                lower = [line for line in block if min(word["y"] for word in line) > table["bottom"]]
                if upper:
                    above.extend(classify_block(upper, body_height, width))
                if lower:
                    below.extend(classify_block(lower, body_height, width))
            nodes = above + [table["node"]] + below
        else:
            nodes = [node for block in blocks for node in classify_block(block, body_height, width)]
        nodes = join_title_lines(nodes)
        source_text = " ".join(word["text"] for word in accepted)
        rendered_text = " ".join(node.get("source_text", node["text"]) for node in nodes)
        if collections.Counter(source_text.split()) != collections.Counter(rendered_text.split()):
            raise ValueError(f"Text preservation failed on PDF page {number}")
        headings = [node["text"] for node in nodes if node["kind"] == "heading"]
        result.append({
            "page": number, "anchor": f"page-{number:03d}",
            "width_points": width, "height_points": height,
            "rotation": rotations.get(number, 0), "visible_word_count": len(accepted),
            "excluded_off_crop_words": excluded, "text_preserved": True,
            "text": "\n\n".join(node["text"] for node in nodes),
            "source_text": source_text,
            "layout": laid_out([line for block in blocks for line in block], width),
            "headings": headings, "nodes": nodes,
            "printed_page_label": next((node["text"] for node in nodes if node["kind"] == "footer"), None),
        })
    return result


STYLE = """
:root{color-scheme:light;--paper:#fffdf8;--ink:#292724;--muted:#686057;--line:#d8cdbd;--accent:#65461f}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f2eee5;color:var(--ink);font:18px/1.65 Georgia,serif}
a{color:var(--accent)}aside{position:fixed;inset:0 auto 0 0;width:290px;padding:24px;overflow:auto;background:#e8e0d3;border-right:1px solid var(--line);font:14px/1.5 system-ui,sans-serif}
aside h1{font-size:22px;line-height:1.2;margin:0 0 14px}aside ol{padding-left:20px}aside li{margin:7px 0}aside input{width:100%;padding:10px;border:1px solid #958b7d;border-radius:4px;font:inherit}aside label{display:block;font-weight:600;margin:20px 0 6px}
main{max-width:1110px;margin-left:290px;padding:32px 46px}.intro,.page{background:var(--paper);border:1px solid var(--line);padding:30px 38px;margin-bottom:28px;border-radius:6px;box-shadow:0 2px 8px #00000008}
h1,h2,h3{font-family:system-ui,sans-serif;line-height:1.25}h2{font-size:24px}h3{font-size:21px;margin-top:1.6em}p{margin:0 0 1.1em}.page:target{outline:3px solid #b08e57}.page nav{display:flex;flex-wrap:wrap;gap:15px;font:14px/1.5 system-ui,sans-serif;margin:0 0 24px}.page header{border-bottom:1px solid var(--line);margin-bottom:24px}.page header h2{margin:0 0 12px}.muted,.source-footer{color:var(--muted);font:14px/1.55 system-ui,sans-serif}.source-footer{border-top:1px solid var(--line);padding-top:12px}
details{border:1px solid var(--line);padding:12px 16px;margin:20px 0}summary{cursor:pointer;font:600 14px/1.5 system-ui,sans-serif}figure{margin:20px 0 0}figure img{display:block;width:100%;height:auto}figcaption{font:14px/1.5 system-ui,sans-serif;color:var(--muted);margin-top:10px}pre{white-space:pre;overflow:auto;background:#f3f0e8;padding:16px;font:13px/1.5 monospace}.list-item{padding-left:1.3em;text-indent:-1.3em}.notice{border-left:4px solid #a88046;padding-left:16px}#results{margin:12px 0}#results a{display:block;margin:5px 0}.hidden{display:none!important}
table{width:100%;border-collapse:collapse;font:15px/1.55 system-ui,sans-serif;margin:20px 0}th,td{padding:10px;border:1px solid var(--line);text-align:left;vertical-align:top}th{background:#eee7db}td:first-child{white-space:nowrap}
@media(max-width:950px){aside{position:static;width:auto;max-height:440px;border-bottom:1px solid var(--line)}main{margin:0;padding:20px}.intro,.page{padding:24px}}@media print{aside,.page nav,details,.intro{display:none}main{margin:0;padding:0}.page{border:none;box-shadow:none;break-before:page;padding:0}body{background:white;font-size:11pt}}
"""

SEARCH = """
(() => {
  const pages = [...document.querySelectorAll('section.page')];
  const input = document.getElementById('search');
  const results = document.getElementById('results');
  const status = document.getElementById('search-status');
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    let matches = 0;
    for (const page of pages) {
      const found = !query || page.querySelector('.extracted').textContent.toLocaleLowerCase().includes(query);
      page.classList.toggle('hidden', !found);
      if (found) {
        matches++;
        if (query) {
          const link = document.createElement('a');
          link.href = '#' + page.id;
          link.textContent = page.dataset.label;
          results.append(link);
        }
      }
    }
    status.textContent = query ? matches + ' matching PDF pages. Image-only text is not searchable.' : pages.length + ' PDF pages; search runs locally.';
  });
  document.querySelectorAll('a[href^="#page-"]').forEach(link => link.addEventListener('click', () => {
    const target = document.getElementById(link.hash.slice(1));
    if (target) target.classList.remove('hidden');
  }));
})();
"""


def toc_entries(pages):
    entries = []
    for page in pages:
        nodes = page["nodes"]
        for index, node in enumerate(nodes):
            if node["kind"] == "heading" and node["major"]:
                title = node["text"]
                entries.append({"title": title.strip(), "page": page["page"], "anchor": page["anchor"]})
    return entries


def write_documents(source, destination, pages, entries, facsimiles):
    pdf_link = Path(os.path.relpath(source, destination)).as_posix()
    escaped_pdf = html.escape(pdf_link, quote=True)
    warning = ("This is a text extraction with original-page facsimiles, not a new edition. "
               "PDF page numbers identify physical source pages; printed page labels can differ near the end. Paragraphs are reflowed and line-wrap hyphens joined; "
               "tables encoded as aligned text retain their layout. Illustrations, raster tables and decorative letters "
               "may have no text layer: consult the original-page image. No OCR or guessed transcription is used. "
               "The supplied PDF remains unchanged. These copyrighted reference files are private local material.")
    md = ["# Arcanum player manual", "", warning, "", "## Chapter and section index", ""]
    nav = []
    for entry in entries:
        md.append(f"- [{md_text(entry['title'])}](#{entry['anchor']}) - PDF page {entry['page']}")
        nav.append(f'<li><a href="#{entry["anchor"]}">{html.escape(entry["title"])}</a> <small>p. {entry["page"]}</small></li>')
    body = []
    for page in pages:
        number, anchor = page["page"], page["anchor"]
        md += ["", f'<a id="{anchor}"></a>', "", f"## PDF page {number}", "",
               f"[Original PDF page]({pdf_link}#page={number})", ""]
        buttons = []
        if number > 1:
            buttons.append(f'<a href="#page-{number - 1:03d}">Previous page</a>')
        buttons += [f'<a href="{escaped_pdf}#page={number}">Original PDF page {number}</a>', '<a href="#index">Index</a>']
        if number < len(pages):
            buttons.append(f'<a href="#page-{number + 1:03d}">Next page</a>')
        page_html = []
        for node in page["nodes"]:
            text = node["text"]
            if node["kind"] == "heading":
                md += ["### " + md_text(text), ""]
                page_html.append("<h3>" + html.escape(text) + "</h3>")
            elif node["kind"] == "layout":
                md += ["```text", text, "```", ""]
                page_html.append('<pre aria-label="Aligned source text">' + html.escape(text) + "</pre>")
            elif node["kind"] == "table":
                md += ["| Key | Action |", "| --- | --- |"]
                for key, action in node["rows"]:
                    md.append("| " + md_text(key).replace("|", "\\|") + " | " + md_text(action).replace("|", "\\|") + " |")
                md.append("")
                rows = "".join("<tr><td>" + html.escape(key) + "</td><td>" + html.escape(action) + "</td></tr>"
                               for key, action in node["rows"])
                page_html.append('<table><thead><tr><th scope="col">Key</th><th scope="col">Action</th></tr></thead><tbody>' + rows + '</tbody></table>')
            elif node["kind"] == "list":
                # Preserve the original labels, rather than letting Markdown
                # silently renumber discontinuous source lists.
                md += [md_text(text), ""]
                page_html.append('<p class="list-item">' + html.escape(text) + "</p>")
            elif node["kind"] == "footer":
                md += ["*" + md_text(text) + "*", ""]
                page_html.append('<p class="source-footer">' + html.escape(text) + "</p>")
            else:
                md += [md_text(text), ""]
                page_html.append("<p>" + html.escape(text) + "</p>")
        if not page["visible_word_count"] or page["visible_word_count"] < 15:
            note = "This page has little extractable text; its artwork/table is preserved in the original-page image."
            md += [note, ""]
            page_html.append('<p class="notice">' + note + "</p>")
        if facsimiles:
            image_path = f"pages/{anchor}.jpg"
            caption = f"Original PDF page {number}, including artwork and image-only text."
            open_attribute = " open" if page["visible_word_count"] < 15 else ""
            md += [f"<details{open_attribute}>", "<summary>Original page artwork and tables</summary>", "",
                   f"![{caption}]({image_path})", "", "</details>", ""]
            image_html = (f'<details{open_attribute}><summary>Original page artwork and tables</summary><figure>'
                          f'<a href="{image_path}"><img src="{image_path}" alt="{caption}" loading="lazy" decoding="async"></a>'
                          f'<figcaption>{caption}</figcaption></figure></details>')
        else:
            image_html = ""
        md += ["<details>", "<summary>Visible PDF text in source layout</summary>", "", "```text",
               page["layout"], "```", "", "</details>", ""]
        layout_html = ('<details><summary>Visible PDF text in source layout</summary><pre>' +
                       html.escape(page["layout"]) + '</pre></details>')
        label = f"PDF page {number}" + (" - " + page["headings"][0] if page["headings"] else "")
        body.append(f'<section class="page" id="{anchor}" data-label="{html.escape(label, quote=True)}">'
                    f'<header><h2>PDF page {number}</h2><nav>{" ".join(buttons)}</nav></header>'
                    f'<div class="extracted">{"".join(page_html)}</div>{image_html}{layout_html}</section>')
    markup = (f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1">'
              '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">'
              '<title>Arcanum player manual - local reference</title><style>' + STYLE + '</style></head><body>'
              '<aside id="index"><h1>Arcanum player manual</h1><p>Private local reference</p>'
              '<label for="search">Search extracted text</label><input id="search" type="search" placeholder="e.g. fatigue or multiplayer">'
              f'<p id="search-status" role="status">{len(pages)} PDF pages; search runs locally.</p><div id="results"></div>'
              '<h2>Chapter / section index</h2><ol>' + "".join(nav) + '</ol></aside><main>'
              '<section class="intro"><h1>Arcanum player manual</h1><p class="notice">' + html.escape(warning) +
              f'</p><p><a href="{escaped_pdf}">Open supplied PDF</a> · <a href="manual.md">Markdown version</a> · '
              '<a href="extraction-manifest.json">Extraction manifest</a></p></section>' +
              "".join(body) + '</main><script>' + SEARCH + '</script></body></html>\n')
    (destination / "manual.md").write_text("\n".join(md), encoding="utf-8")
    (destination / "manual.html").write_text(markup, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path, help="User-supplied local PDF; never modified")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[2] / "local-data/reference/manual")
    parser.add_argument("--dpi", type=int, default=110, help="Original-page JPEG resolution (default: 110)")
    parser.add_argument("--no-facsimiles", action="store_true", help="Text only; raster tables/artwork remain in source PDF")
    parser.add_argument("--reuse-facsimiles", action="store_true", help="Reuse images only when previous source hash, page count and DPI match")
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[2]
    destination = args.output.resolve()
    if not destination.is_relative_to((project / "local-data").resolve()):
        parser.error("Copyrighted conversion outputs must stay inside the project's ignored local-data directory")
    if not 72 <= args.dpi <= 240:
        parser.error("--dpi must be between 72 and 240")
    source = args.source.resolve(strict=True)
    for tool in ("pdfinfo", "pdftotext", "pdftoppm"):
        if not shutil.which(tool):
            parser.error(f"Required Poppler command is missing: {tool}")
    source_sha = digest(source)
    count, rotations, basic, detailed = page_info(source)
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="manual-conversion-") as temp:
        xml = Path(temp) / "visible-bounds.xml"
        run(["pdftotext", "-cropbox", "-bbox-layout", str(source), str(xml)])
        pages = extract_pages(xml, rotations)
        if len(pages) != count:
            raise ValueError(f"Expected {count} PDF pages, extracted {len(pages)}")
        # Keep an exact machine-readable extraction for page-level auditing.
        shutil.copyfile(xml, destination / "manual-word-boxes.xml")
        if not args.no_facsimiles:
            image_dir = destination / "pages"
            image_dir.mkdir(exist_ok=True)
            if args.reuse_facsimiles:
                previous = json.loads((destination / "extraction-manifest.json").read_text())
                if (previous.get("source_sha256") != source_sha or previous.get("pdf_pages") != count or
                        previous.get("facsimile_dpi") != args.dpi or previous.get("facsimile_pages") != count):
                    raise ValueError("Existing facsimiles do not match this source PDF, page count and DPI")
            else:
                run(["pdftoppm", "-cropbox", "-r", str(args.dpi), "-jpeg", "-jpegopt", "quality=87",
                     str(source), str(image_dir / "page")])
            padding = len(str(count))
            for number in range(1, count + 1):
                generated = image_dir / f"page-{number:0{padding}d}.jpg"
                expected = image_dir / f"page-{number:03d}.jpg"
                if generated != expected:
                    generated.rename(expected)
                if not expected.is_file() or expected.stat().st_size == 0:
                    raise ValueError(f"Missing facsimile for PDF page {number}")
    entries = toc_entries(pages)
    write_documents(source, destination, pages, entries, not args.no_facsimiles)
    (destination / "manual-pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (destination / "manual-cropped-layout.txt").write_text("\f".join(page["layout"] for page in pages) + "\f", encoding="utf-8")
    (destination / "manual-cropped-reading-order.txt").write_text("\f".join(page["text"] for page in pages) + "\f", encoding="utf-8")
    (destination / "manual-pdfinfo.txt").write_text(detailed, encoding="utf-8")
    if digest(source) != source_sha:
        raise ValueError("Source PDF changed during conversion")
    manifest = {
        "source": str(source), "source_sha256": source_sha, "source_bytes": source.stat().st_size,
        "source_unchanged": True, "pdf_pages": count, "converted_pages": len(pages),
        "page_anchor_format": "page-NNN (one-based physical PDF page)",
        "visible_pdf_words": sum(page["visible_word_count"] for page in pages),
        "off_crop_words_excluded": sum(page["excluded_off_crop_words"] for page in pages),
        "all_visible_pdf_text_preserved": all(page["text_preserved"] for page in pages),
        "text_validation": "Every visible source PDF word retained once; PDF block reading order preserved except geometric key/action table reassembly; only whitespace and line-wrap hyphens normalized",
        "facsimile_pages": 0 if args.no_facsimiles else count, "facsimile_dpi": None if args.no_facsimiles else args.dpi,
        "image_only_or_low_text_pages": [page["page"] for page in pages if page["visible_word_count"] < 15],
        "chapter_section_index": entries,
        "limitations": ["No OCR: raster tables, figure text and decorative drop capitals are preserved in facsimiles, not invented in extracted prose",
                        "Paragraph/heading/list structure inferred from PDF geometry; original-page images are authoritative for layout",
                        "Printer-spread text outside each rotated visible CropBox is intentionally excluded",
                        "User-supplied copyrighted reference content; keep outputs private and ignored"],
        "tools": {tool: subprocess.run([tool, "-v"], capture_output=True, text=True).stderr.splitlines()[0]
                  for tool in ("pdfinfo", "pdftotext", "pdftoppm")},
        "pages": [{key: page[key] for key in ("page", "anchor", "visible_word_count", "excluded_off_crop_words", "text_preserved")}
                  for page in pages],
        "outputs": {},
    }
    for name in ["manual.md", "manual.html", "manual-pages.json", "manual-word-boxes.xml", "manual-cropped-layout.txt", "manual-cropped-reading-order.txt", "manual-pdfinfo.txt"]:
        file = destination / name
        manifest["outputs"][name] = {"bytes": file.stat().st_size, "sha256": digest(file)}
    (destination / "extraction-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pages": count, "words": manifest["visible_pdf_words"],
                      "off_crop_words_excluded": manifest["off_crop_words_excluded"],
                      "facsimiles": manifest["facsimile_pages"], "output": str(destination)}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"Manual conversion failed: {error}", file=sys.stderr)
        sys.exit(1)

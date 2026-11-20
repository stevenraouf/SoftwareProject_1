"""Render the project's Markdown guides as one navigable PDF reading copy.

Run: python scripts/export_handbook.py --date YYYY-MM-DD
Use a Python environment containing reportlab. The original Markdown and
review status fields are preserved. Generated pages use embedded system fonts.
"""
from pathlib import Path
import argparse
from datetime import date
import hashlib
import html
import json
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, LongTable, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.graphics.shapes import Drawing, Rect, Line, Polygon, String, Circle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
QA = ROOT / 'tmp/pdfs'
PAGE_W, PAGE_H = A4
MARGIN = 44
WIDTH = PAGE_W - 2 * MARGIN
NAVY = colors.HexColor('#18394B')
TEAL = colors.HexColor('#177C83')
INK = colors.HexColor('#243B49')
MUTED = colors.HexColor('#5B6F7B')
PALE = colors.HexColor('#F2F6F8')
RULE = colors.HexColor('#D8E2E7')

SOURCES = [
    ('00', 'Submission readiness and final actions', 'docs/milestone-1/SUBMISSION_READINESS.md'),
    ('01', 'AI policy and solo submission', 'docs/milestone-1/AI_POLICY_AND_SOLO_SUBMISSION.md'),
    ('02', 'Your review and discussion guide', 'docs/milestone-1/SOLO_REVIEW_AND_DISCUSSION_GUIDE.md'),
    ('02A', 'Student approval and test attribution', 'docs/milestone-1/STUDENT_APPROVAL_AND_TEST_RECORD.md'),
    ('03', 'Strategy, plan and workflow', 'docs/milestone-1/STRATEGY_PLAN_WORKFLOW.md'),
    ('04', 'Setup and running the backend', 'README.md'),
    ('05', 'Swagger evaluation walkthrough', 'docs/api/SWAGGER_WALKTHROUGH.md'),
    ('06', 'Review and verification evidence', 'docs/milestone-1/REVIEW_AND_VERIFICATION.md'),
    ('07', 'Follow-up coverage audit', 'docs/milestone-1/COVERAGE_AUDIT.md'),
    ('08', 'Reverse engineering and handover', 'docs/milestone-1/REVERSE_ENGINEERING.md'),
    ('09', 'API test report', 'docs/milestone-1/API_TEST_REPORT.md'),
    ('10', 'Real Stripe verification results', 'docs/milestone-1/STRIPE_VERIFICATION_REPORT.md'),
    ('11', 'Stripe integration and reproduction', 'docs/milestone-1/STRIPE_INTEGRATION_VERIFICATION.md'),
    ('12', 'Live verification of all 11 bonuses', 'docs/milestone-1/BONUS_VERIFICATION.md'),
    ('A', 'AI prompt log', 'AI_PROMPTS.txt'),
    ('B', 'Requirements traceability', 'docs/requirements/TRACEABILITY.md'),
    ('C', 'API endpoint index', 'docs/api/ENDPOINTS.md'),
    ('D', 'Specification sources', 'docs/requirements/SOURCES.md'),
]
SOURCE_KEYS = {(ROOT / name).resolve(): f'part-{number}' for number, _, name in SOURCES}


def normalize(text):
    for old, new in [('—', ' - '), ('–', '-'), ('‑', '-'), ('‑', '-'), ('−', '-'), ('“', '"'), ('”', '"'), ('‘', "'"), ('’', "'"), ('→', '->')]:
        text = text.replace(old, new)
    return text


def register_fonts():
    win = Path('C:/Windows/Fonts')
    alternatives = Path('/usr/share/fonts/truetype/dejavu')
    paths = {
        'Body': win / 'arial.ttf', 'Body-Bold': win / 'arialbd.ttf',
        'Body-Italic': win / 'ariali.ttf', 'Body-BoldItalic': win / 'arialbi.ttf',
        'Mono': win / 'consola.ttf',
    }
    fallbacks = {
        'Body': 'DejaVuSans.ttf', 'Body-Bold': 'DejaVuSans-Bold.ttf',
        'Body-Italic': 'DejaVuSans-Oblique.ttf', 'Body-BoldItalic': 'DejaVuSans-BoldOblique.ttf',
        'Mono': 'DejaVuSansMono.ttf',
    }
    for name, path in paths.items():
        if not path.exists():
            path = alternatives / fallbacks[name]
        if not path.exists():
            raise RuntimeError(f'Missing readable embedded font: {name}')
        pdfmetrics.registerFont(TTFont(name, str(path)))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='Body-Bold', italic='Body-Italic', boldItalic='Body-BoldItalic')
    pdfmetrics.registerFontFamily('Mono', normal='Mono', bold='Mono', italic='Mono', boldItalic='Mono')


def inline(text, source):
    text = normalize(text)
    tokens = []

    def stash(value):
        key = f'ZZTOKEN{len(tokens)}ZZ'
        tokens.append(value)
        return key

    text = re.sub(r'<br\s*/?>', lambda _: stash('<br/>'), text, flags=re.I)
    text = re.sub(r'`([^`]+)`', lambda m: stash('<font name="Mono" size="9">' + html.escape(m[1]) + '</font>'), text)

    def link(match):
        label, target = match.group(1), match.group(2)
        if target.startswith(('https://', 'http://')):
            href = target
        else:
            local = (source.parent / target.split('#')[0]).resolve()
            href = '#' + SOURCE_KEYS[local] if local in SOURCE_KEYS else local.as_uri()
        return stash(f'<link href="{html.escape(href, quote=True)}" color="#147881">{inline(label, source)}</link>')

    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = html.escape(text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    text = re.sub(r'https?://[^\s<>]+', lambda m: f'<link href="{m[0]}" color="#147881">{m[0]}</link>', text)
    for i, value in enumerate(tokens):
        text = text.replace(f'ZZTOKEN{i}ZZ', value)
    return text


def styles():
    base = getSampleStyleSheet()
    body = ParagraphStyle('Body', fontName='Body', fontSize=10.5, leading=15.4, textColor=INK, spaceAfter=8, splitLongWords=True, allowWidows=0, allowOrphans=0)
    result = {
        'body': body,
        'chapter': ParagraphStyle('Chapter', parent=body, fontName='Body-Bold', fontSize=23, leading=28, textColor=NAVY, spaceBefore=4, spaceAfter=9, keepWithNext=True),
        'h2': ParagraphStyle('H2', parent=body, fontName='Body-Bold', fontSize=14, leading=18, textColor=NAVY, spaceBefore=15, spaceAfter=7, keepWithNext=True),
        'h3': ParagraphStyle('H3', parent=body, fontName='Body-Bold', fontSize=11.5, leading=15, textColor=TEAL, spaceBefore=10, spaceAfter=6, keepWithNext=True),
        'caption': ParagraphStyle('Caption', parent=body, fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=13),
        'source': ParagraphStyle('Source', parent=body, fontSize=8.4, leading=12, textColor=MUTED, spaceAfter=15, keepWithNext=True),
        'cell': ParagraphStyle('Cell', parent=body, fontSize=9.25, leading=12.3, spaceAfter=0, allowWidows=1, allowOrphans=1),
        'th': ParagraphStyle('TableHeader', parent=body, fontName='Body-Bold', fontSize=9.3, leading=12, textColor=colors.white, spaceAfter=0),
        'code': ParagraphStyle('Code', parent=body, fontName='Mono', fontSize=9.4, leading=12.5, backColor=PALE, borderPadding=8, spaceBefore=5, spaceAfter=11, allowWidows=1, allowOrphans=1),
        'bullet': ParagraphStyle('Bullet', parent=body, leftIndent=14, firstLineIndent=0, bulletIndent=1, bulletFontName='Body', bulletFontSize=10.5, spaceAfter=6),
        'coverTitle': ParagraphStyle('CoverTitle', parent=body, fontName='Body-Bold', fontSize=35, leading=40, textColor=NAVY, spaceAfter=15),
        'coverSub': ParagraphStyle('CoverSub', parent=body, fontSize=14, leading=21, textColor=MUTED, spaceAfter=18),
    }
    return result


class Handbook(BaseDocTemplate):
    def __init__(self, path, **kwargs):
        super().__init__(str(path), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=53, bottomMargin=47, title='Milestone 1 Project Handbook', author='Project repository - AI-assisted reading copy', **kwargs)
        frame = Frame(MARGIN, 47, WIDTH, PAGE_H - 100, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id='normal', frames=[frame], onPage=self.decorate))
        self.running = ''
        self.source = ''
        self.section_starts = {}

    def beforeDocument(self):
        self.running = ''
        self.source = ''
        self.section_starts = {}

    def decorate(self, canvas, _doc):
        canvas.saveState()
        if self.page > 1:
            canvas.setFillColor(MUTED)
            canvas.setFont('Body', 8)
            canvas.drawString(MARGIN, PAGE_H - 27, 'TRAVEL PLANNING AND BOOKING / MILESTONE 1')
            canvas.setStrokeColor(RULE)
            canvas.line(MARGIN, PAGE_H - 35, PAGE_W - MARGIN, PAGE_H - 35)
        canvas.setStrokeColor(RULE)
        canvas.line(MARGIN, 34, PAGE_W - MARGIN, 34)
        canvas.setFillColor(MUTED)
        canvas.setFont('Body', 7.8)
        canvas.drawString(MARGIN, 21, 'Reading copy - original Markdown remains editable')
        canvas.drawRightString(PAGE_W - MARGIN, 21, f'Page {self.page}')
        canvas.restoreState()

    def afterFlowable(self, flowable):
        key = getattr(flowable, 'nav_key', None)
        if not key:
            return
        level = flowable.nav_level
        title = flowable.nav_title
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(title, key, level=level, closed=level == 0)
        if level < 2:
            self.notify('TOCEntry', (level, html.escape(title), self.page, key))
        if level == 0:
            self.running = title
            self.source = flowable.nav_source
            self.section_starts[key] = self.page


def heading(text, style, key, level, source=''):
    p = Paragraph(html.escape(normalize(text)), style)
    p.nav_key, p.nav_level, p.nav_title, p.nav_source = key, level, normalize(text), source
    return p


def box(d, x, y, width, label, fill=PALE, height=44):
    d.add(Rect(x, y, width, height, rx=5, ry=5, fillColor=fill, strokeColor=RULE, strokeWidth=0.8))
    lines = label.split('\n')
    for i, line in enumerate(lines):
        d.add(String(x + width / 2, y + height / 2 + (len(lines) - 1) * 5.5 - i * 11 - 3, line, fontName='Body-Bold', fontSize=9, fillColor=INK, textAnchor='middle'))


def arrow(d, points, color=TEAL):
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1.2))
    (x1, y1), (x2, y2) = points[-2:]
    if x2 > x1: tri = [x2, y2, x2 - 6, y2 + 3, x2 - 6, y2 - 3]
    elif x2 < x1: tri = [x2, y2, x2 + 6, y2 + 3, x2 + 6, y2 - 3]
    elif y2 > y1: tri = [x2, y2, x2 - 3, y2 - 6, x2 + 3, y2 - 6]
    else: tri = [x2, y2, x2 - 3, y2 + 6, x2 + 3, y2 + 6]
    d.add(Polygon(tri, strokeColor=color, fillColor=color))


def architecture():
    d = Drawing(WIDTH, 562)
    for y, text in [(500, 'Swagger / future\nNext.js client'), (430, 'HTTPS NestJS\ncontrollers'), (360, 'Session / role /\nCSRF guard'), (290, 'Validated\nrequest DTO'), (220, 'Feature\nservices')]: box(d, 0, y, 135, text)
    for y in [500, 430, 360, 290]: arrow(d, [(67.5, y), (67.5, y - 26)])
    box(d, 195, 220, 135, 'MongoDB Atlas', colors.HexColor('#E8F3EE'))
    box(d, 195, 140, 135, 'Persisted outbox', colors.HexColor('#E8F3EE'))
    box(d, 390, 140, 115, 'Scheduled\nworkers', colors.HexColor('#FFF2DB'))
    box(d, 195, 60, 135, 'Stripe test API', colors.HexColor('#EEEAF8'))
    box(d, 0, 60, 135, 'Signed webhook', colors.HexColor('#EEEAF8'))
    box(d, 390, 65, 115, 'SMTP test inbox', colors.HexColor('#EEEAF8'))
    box(d, 390, 0, 115, 'FXRatesAPI', colors.HexColor('#EEEAF8'))
    arrow(d, [(135, 242), (195, 242)])
    arrow(d, [(135, 232), (175, 232), (175, 162), (195, 162)])
    arrow(d, [(135, 222), (160, 222), (160, 90), (195, 90)])
    arrow(d, [(195, 76), (135, 76)])
    arrow(d, [(67.5, 104), (67.5, 220)])
    arrow(d, [(390, 162), (330, 162)])
    arrow(d, [(447.5, 184), (447.5, 275), (67.5, 275), (67.5, 264)])
    arrow(d, [(447.5, 140), (447.5, 109)])
    arrow(d, [(390, 150), (365, 150), (365, 22), (390, 22)])
    return d


def lifecycle():
    d = Drawing(WIDTH, 255)
    box(d, 0, 120, 120, 'Pending Payment', height=50)
    box(d, 192, 120, 120, 'Confirmed', height=50)
    box(d, 384, 120, 120, 'Completed', colors.HexColor('#E8F3EE'), height=50)
    box(d, 0, 0, 120, 'Expired', colors.HexColor('#FFF2DB'), height=50)
    box(d, 192, 0, 120, 'Cancelled', colors.HexColor('#FFF2DB'), height=50)
    d.add(Circle(60, 236, 4, fillColor=NAVY, strokeColor=NAVY))
    arrow(d, [(60, 232), (60, 170)])
    arrow(d, [(120, 145), (192, 145)])
    arrow(d, [(312, 145), (384, 145)])
    arrow(d, [(60, 120), (60, 50)])
    arrow(d, [(252, 120), (252, 50)])
    for x, y, text in [(115, 203, 'Atomic hold'), (156, 188, 'Verified payment'), (348, 188, 'Travel complete'), (88, 81, 'Hold timeout'), (325, 86, 'Eligible cancellation')]:
        d.add(String(x, y, text, fontName='Body', fontSize=9, fillColor=MUTED, textAnchor='middle'))
    return d


def widths_for(headers):
    count = len(headers)
    joined = ' '.join(headers).lower()
    if count == 2:
        values = [0.28, 0.72]
    elif count == 3:
        values = [0.25, 0.35, 0.40]
        if 'severity' in joined: values = [0.34, 0.12, 0.54]
    elif count == 4:
        values = [0.18, 0.26, 0.29, 0.27]
        if headers[0].lower() == 'method': values = [0.12, 0.45, 0.18, 0.25]
        elif headers[0].lower() == 'id': values = [0.12, 0.14, 0.35, 0.39]
        elif 'target' in headers[0].lower(): values = [0.18, 0.36, 0.46] if count == 3 else values
    elif count == 6 and headers[0].lower() == 'method':
        values = [0.12, 0.40, 0.12, 0.12, 0.12, 0.12]
    else:
        values = [1 / count] * count
    return [WIDTH * n for n in values]


def table(rows, source, st):
    headers = rows[0]
    horizontal_padding = 4 if len(headers) == 6 and headers[0].lower() == 'method' else 8
    data = [[Paragraph(inline('No login' if r == 0 and cell == 'Anonymous' else cell, source), st['th'] if r == 0 else st['cell']) for cell in row] for r, row in enumerate(rows)]
    t = LongTable(data, colWidths=widths_for(headers), repeatRows=1, hAlign='LEFT', splitByRow=1, splitInRow=0, spaceBefore=4, spaceAfter=12)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), horizontal_padding), ('RIGHTPADDING', (0, 0), (-1, -1), horizontal_padding),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, PALE]),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, NAVY),
        ('LINEBELOW', (0, 1), (-1, -1), 0.35, RULE),
    ]))
    return t


def code_paragraph(lines, st):
    value = '<br/>'.join(html.escape(normalize(line)).replace('  ', '&nbsp;&nbsp;') or ' ' for line in lines)
    return Paragraph(value, st['code'])


def parse_markdown(source, key, st):
    lines = source.read_text(encoding='utf-8-sig').splitlines()
    story, i, number = [], 0, 0
    while i < len(lines):
        line = lines[i].strip()
        if not line: i += 1; continue
        if line.startswith('```'):
            language = line[3:].strip()
            block = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                block.append(lines[i]); i += 1
            if language == 'mermaid':
                graph = '\n'.join(block)
                if 'flowchart LR' in graph:
                    story += [architecture(), Paragraph('Architecture diagram rendered from the original Mermaid relationships.', st['caption'])]
                elif 'stateDiagram-v2' in graph:
                    story += [lifecycle(), Paragraph('Only the original hold timeout enters Expired. Earlier invalidation releases inventory and blocks payment while the booking remains Pending Payment.', st['caption'])]
                else: story.append(code_paragraph(block, st))
            else: story.append(code_paragraph(block, st))
            i += 1; continue
        if line.startswith('# '): i += 1; continue
        match = re.match(r'^(#{2,3})\s+(.+)', line)
        if match:
            number += 1
            level = len(match[1]) - 1
            story.append(heading(match[2], st['h2'] if level == 1 else st['h3'], f'{key}-h{number}', level))
            i += 1; continue
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|?\s*:?-{3,}', lines[i + 1].strip()):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = lines[i].strip().strip('|')
                if not re.match(r'^\s*:?-{3,}', row):
                    rows.append([s.strip() for s in row.split('|')])
                i += 1
            if len({len(row) for row in rows}) != 1:
                raise RuntimeError(f'Malformed Markdown table in {source}')
            story.append(table(rows, source, st)); continue
        bullet = re.match(r'^(?:- |\* )(.*)', line)
        numbered = re.match(r'^(\d+)\.\s+(.*)', line)
        if bullet:
            text = bullet[1]
            marker = '[ ]' if text.startswith('[ ] ') else '\u2022'
            if marker == '[ ]': text = text[4:]
            story.append(Paragraph(inline(text, source), st['bullet'], bulletText=marker)); i += 1; continue
        if numbered:
            story.append(Paragraph(inline(numbered[2], source), st['bullet'], bulletText=numbered[1] + '.')); i += 1; continue
        if re.fullmatch(r'[-*_]{3,}', line):
            story.append(HRFlowable(width='100%', thickness=0.5, color=RULE, spaceBefore=5, spaceAfter=8)); i += 1; continue
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(?:#{1,3}\s|\| |\||```|- |\* |\d+\.\s)', lines[i].strip()):
            paragraph.append(lines[i].strip()); i += 1
        story.append(Paragraph(inline(' '.join(paragraph), source), st['body']))
    return story


def parse_log(source, st):
    text = source.read_text(encoding='utf-8-sig')
    return [code_paragraph(block.strip().splitlines(), st) for block in re.split(r'^={8,}\s*$', text, flags=re.M) if block.strip()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date', required=True, help='Reading-copy revision date YYYY-MM-DD')
    revision = date.fromisoformat(parser.parse_args().date)
    register_fonts()
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    st = styles()
    story = [Spacer(1, 58), Paragraph('MILESTONE 1', st['h3']), Paragraph('Project<br/>handbook', st['coverTitle']), Paragraph('Travel Planning and Booking Platform<br/>Implementation blueprint and technical handover', st['coverSub']), HRFlowable(width=82, thickness=3, color=TEAL, hAlign='LEFT', spaceAfter=21), Paragraph(revision.strftime('%d %B %Y').lstrip('0'), st['body']), Spacer(1, 12), Paragraph('<b>Start with chapter 00</b> for submission readiness and your remaining actions, <b>chapter 03</b> for the strategy and workflow, and <b>chapter 08</b> for the actual implementation, diagrams, database and booking lifecycle.', st['body']), Spacer(1, 12), Paragraph('This edition includes the current API, Atlas, real Stripe sandbox, SMTP test-inbox and all 11 bonus verification results. Owner approval for the supplied explanations and documentation/package finalization was recorded on 20 November. Personal Swagger use is reported; individual personal results, credential rotation and release integration are not asserted. Chapter 02A separates those facts from the actual engineering evidence. Codex is an AI tool; there is one human student/developer.', st['body']), Spacer(1, 12), Paragraph('Use the clickable contents or PDF bookmarks to navigate. Original Markdown files remain the editable source; source-code links point to the local workspace.', st['body']), PageBreak(), Paragraph('Contents', st['chapter'])]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('TOC0', fontName='Body-Bold', fontSize=11, leading=15.5, textColor=NAVY, leftIndent=0, firstLineIndent=0, spaceBefore=11), ParagraphStyle('TOC1', fontName='Body', fontSize=9.6, leading=13.2, textColor=INK, leftIndent=14, firstLineIndent=0, spaceBefore=3)]
    story += [toc]
    hashes = {}
    for number, title, name in SOURCES:
        source = ROOT / name
        hashes[name] = hashlib.sha256(source.read_bytes()).hexdigest()
        key = f'part-{number}'
        story += [PageBreak(), heading(f'{number}  {title}', st['chapter'], key, 0, name), Paragraph(html.escape(name), st['source']), HRFlowable(width='100%', color=TEAL, thickness=1, spaceAfter=12)]
        story += parse_log(source, st) if source.suffix == '.txt' else parse_markdown(source, key, st)
    path = OUT / f'MILESTONE_1_HANDBOOK_{revision.isoformat()}.pdf'
    doc = Handbook(path)
    doc.multiBuild(story)
    for name, digest in hashes.items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
    result = {'pdf': str(path), 'revisionDate': revision.isoformat(), 'chapters': len(SOURCES), 'pages': doc.page, 'sectionStarts': doc.section_starts, 'originalSourcesUnchanged': True}
    (QA / 'conversion-report.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()

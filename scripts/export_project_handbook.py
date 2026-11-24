"""Append the current frontend guide to the archived backend handbook.

From the repository root, install reportlab, pypdf>=6, pymupdf and pillow,
then run python scripts/export_project_handbook.py. Temporary files and
page renderings go under tmp/milestone-2-handbook/.
"""
from __future__ import annotations

import hashlib
import html
import io
import re
import shutil
import subprocess
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Image as PlacedImage
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, LongTable, PageBreak, PageTemplate, Paragraph, Spacer, TableStyle

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "output/pdf/MILESTONE_1_HANDBOOK_2026-11-20.pdf"
GUIDE = ROOT / "docs/milestone-2/HANDOVER.md"
OUTPUT = ROOT / "output/pdf/AERIS_PROJECT_HANDBOOK.pdf"
TMP = ROOT / "tmp/milestone-2-handbook"
W, H = A4
MARGIN = 48
TEXT_W = W - 2 * MARGIN
INK = colors.HexColor("#192C43")
TEAL = colors.HexColor("#235F68")
MUTED = colors.HexColor("#45576A")
RULE = colors.HexColor("#CAC2BD")
IVORY = colors.HexColor("#FCF7F2")


def fonts():
    candidates = [
        (Path("C:/Windows/Fonts"), "segoeui.ttf", "segoeuib.ttf"),
        (Path("/usr/share/fonts/truetype/dejavu"), "DejaVuSans.ttf", "DejaVuSans-Bold.ttf"),
    ]
    for folder, regular, bold in candidates:
        if (folder / regular).exists() and (folder / bold).exists():
            pdfmetrics.registerFont(TTFont("AerisText", str(folder / regular)))
            pdfmetrics.registerFont(TTFont("AerisBold", str(folder / bold)))
            pdfmetrics.registerFontFamily("AerisText", normal="AerisText", bold="AerisBold")
            return "AerisText", "AerisBold"
    raise RuntimeError("Install Segoe UI or DejaVu Sans to render the handbook.")


class Document(BaseDocTemplate):
    def __init__(self, target, archive_pages, textfont, boldfont):
        super().__init__(str(target), pagesize=A4, title="AERIS · Frontend and final integration")
        self.archive_pages = archive_pages
        self.textfont = textfont
        self.boldfont = boldfont
        self.chapters = []
        frame = Frame(MARGIN, 53, TEXT_W, H - 115, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id="reading", frames=frame, onPage=self.running))

    def running(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(IVORY)
        canvas.rect(0, 0, W, H, fill=1, stroke=0)
        canvas.setStrokeColor(RULE)
        canvas.line(MARGIN, H-44, W-MARGIN, H-44)
        canvas.line(MARGIN, 39, W-MARGIN, 39)
        canvas.setFillColor(TEAL)
        canvas.setFont(self.boldfont, 9)
        canvas.drawString(MARGIN, H-32, "A E R I S")
        canvas.setFillColor(MUTED)
        canvas.setFont(self.textfont, 9)
        canvas.drawRightString(W-MARGIN, H-32, "PROJECT HANDBOOK  /  MILESTONE 2")
        canvas.drawString(MARGIN, 24, "Travel Planning and Booking Platform")
        canvas.drawRightString(W-MARGIN, 24, str(self.archive_pages+doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        title = getattr(flowable, "section_title", None)
        if title:
            self.chapters.append((title, self.page))


def rich(value):
    text = html.escape(value.strip())
    text = re.sub(r"\x60([^\x60]+)\x60", r'<font color="#244E62">\1</font>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)

    def reference(match):
        title, link = match.groups()
        if link.startswith("https://"):
            return f'<a href="{link}" color="#235F68"><u>{title}</u></a>'
        return title
    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", reference, text)


def captured_homepage():
    """Print the real front page at the two viewports used in the browser checks."""
    screens = ROOT / "docs/milestone-2/evidence/screens"
    desktop = screens / "home-desktop.png"
    phone = screens / "home-phone.png"
    if not desktop.is_file() or not phone.is_file():
        return None
    with Image.open(desktop) as d, Image.open(phone) as p:
        d = d.convert("RGB").crop((0,0,d.width,min(d.height,1000)))
        p = p.convert("RGB").crop((0,0,p.width,min(p.height,844)))
        # Preserve both viewport proportions. Borders distinguish the captures from the paper.
        d.thumbnail((1090,800))
        p.thumbnail((342,740))
        d=ImageOps.expand(d,border=2,fill="#bbb4ae")
        p=ImageOps.expand(p,border=2,fill="#bbb4ae")
        contact=Image.new("RGB",(d.width+p.width+25,max(d.height,p.height)),"#FCF7F2")
        contact.paste(d,(0,0))
        contact.paste(p,(d.width+25,0))
    stream=io.BytesIO()
    contact.save(stream,"JPEG",quality=90)
    stream.seek(0)
    return PlacedImage(stream,TEXT_W,TEXT_W*contact.height/contact.width)


def request_diagram(normal, bold):
    from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
    drawing = Drawing(TEXT_W, 93)
    box_w = (TEXT_W-48)/3
    nodes = [("Next.js", "Session and request"), ("NestJS", "Rules and transactions"), ("MongoDB Atlas", "Shared application data")]
    for i, (title, desc) in enumerate(nodes):
        x = i*(box_w+24)
        drawing.add(Rect(x,24,box_w,49,rx=7,ry=7,fillColor=colors.HexColor("#F1EAE4") if i!=1 else colors.HexColor("#DCE9E7"),strokeColor=RULE,strokeWidth=.7))
        drawing.add(String(x+9,53,title,fontName=bold,fontSize=12,fillColor=INK))
        drawing.add(String(x+9,36,desc,fontName=normal,fontSize=9,fillColor=MUTED))
        if i<2:
            drawing.add(Line(x+box_w,49,x+box_w+21,49,strokeColor=TEAL,strokeWidth=1.1))
            drawing.add(Polygon([x+box_w+21,49,x+box_w+16,52,x+box_w+16,46],fillColor=TEAL,strokeColor=TEAL))
    drawing.add(String(0,4,"Stripe sends signed payment events directly to NestJS.",fontName=normal,fontSize=9,fillColor=MUTED))
    return drawing


def write_new_pages(archive_pages, path):
    normal, bold = fonts()
    doc = Document(path, archive_pages, normal, bold)

    def style(name, face=normal, size=11, leading=16, **options):
        return ParagraphStyle(name, fontName=face, fontSize=size, leading=leading,
                              textColor=INK, alignment=TA_LEFT, splitLongWords=1, **options)

    body = style("body", spaceAfter=9)
    small = style("small", size=9.5, leading=14, spaceAfter=6)
    cell = style("cell", size=9.5, leading=13.2)
    title = style("title", bold, 27, 33, spaceAfter=14)
    display = style("display", bold, 40, 44, spaceAfter=8)
    eyebrow = style("overline", bold, 10, 13, spaceAfter=5)
    number = style("step", bold, 11, 16)

    blocks = GUIDE.read_text(encoding="utf-8").replace("\r\n", "\n").split("\n## ")[1:]
    sections = [block.partition("\n")[0] for block in blocks]
    story = [
        Paragraph("FRONTEND AND FINAL INTEGRATION", eyebrow),
        Paragraph("The AERIS<br/>window seat", display),
        Paragraph("Milestone 2  /  November 2026", body),
    ]
    # Crop the approved editorial asset rather than stretching the skyline.
    photo = ROOT / "frontend/public/art/CDG-landscape.jpg"
    with Image.open(photo) as img:
        cover = ImageOps.fit(img.convert("RGB"), (1300, 430), centering=(0.54,0.5))
        jpeg = io.BytesIO()
        cover.save(jpeg, "JPEG", quality=90)
    jpeg.seek(0)
    story.extend([
        PlacedImage(jpeg, TEXT_W, TEXT_W*430/1300), Spacer(1,7),
        Paragraph("Paris skyline photographed by Joe deSousa · CC0 · cropped for this guide", small),
        Spacer(1,7), Paragraph("Inside this chapter", title),
        Paragraph("This edition opens on the frontend. The first "
                  + str(archive_pages) + " pages retain the backend implementation and its dated release evidence. Use the PDF bookmarks to move between sections.", body),
    ])
    for i, name in enumerate(sections):
        story.append(Paragraph(f"{i+1:02d}  ·  "+html.escape(name), small))

    for i, block in enumerate(blocks):
        heading, _, contents = block.partition("\n")
        story.append(PageBreak())
        story.append(Paragraph(f"MILESTONE 2   /   {i+1:02d}", eyebrow))
        head = Paragraph(html.escape(heading), title)
        head.section_title = heading
        story.append(head)
        lines = contents.splitlines()
        pos = 0
        while pos < len(lines):
            line = lines[pos].strip()
            pos += 1
            if not line:
                continue
            if line.startswith("|"):
                table_lines = [line]
                while pos < len(lines) and lines[pos].strip().startswith("|"):
                    table_lines.append(lines[pos].strip())
                    pos += 1
                rows = []
                for row in table_lines:
                    cols = [v.strip() for v in row.strip("|").split("|")]
                    if all(re.fullmatch(r"[-: ]+", v) for v in cols):
                        continue
                    rows.append([Paragraph(rich(v) if rows else "<b>"+rich(v)+"</b>", cell) for v in cols])
                fractions = [0.37, 0.63] if len(rows[0]) == 2 else [0.19, 0.43, 0.38]
                table = LongTable(rows, colWidths=[TEXT_W*f for f in fractions], repeatRows=1, hAlign="LEFT")
                table.setStyle(TableStyle([
                    ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#DCE9E7")),
                    ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#F5EFEB")]),
                    ("VALIGN",(0,0),(-1,-1),"TOP"), ("TOPPADDING",(0,0),(-1,-1),6),
                    ("BOTTOMPADDING",(0,0),(-1,-1),7), ("LEFTPADDING",(0,0),(-1,-1),7),
                    ("RIGHTPADDING",(0,0),(-1,-1),7), ("LINEBELOW",(0,0),(-1,0),0.5,RULE),
                ]))
                story.extend([table, Spacer(1,12)])
                continue
            step = re.match(r"^(\d+)\.\s+(.+)$", line)
            if step:
                table = LongTable([[Paragraph(step[1]+".",number),Paragraph(rich(step[2]),body)]],
                                  colWidths=[22,TEXT_W-22], hAlign="LEFT")
                table.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
                story.append(table)
            else:
                story.append(Paragraph(rich(line), body))
        if heading == "How a screen reaches the database":
            story.append(request_diagram(normal, bold))
        if heading == "The window seat":
            comparison = captured_homepage()
            if comparison:
                story.extend([Spacer(1,13), comparison, Spacer(1,8),
                              Paragraph("The running homepage at 1360 px and 390 px, captured by the browser checks.", small)])
    doc.build(story)
    return doc.chapters


def verify_and_render(archive_count, output, chapters):
    with fitz.open(BASE) as original, fitz.open(output) as combined:
        assert len(combined) > archive_count
        for n in range(archive_count):
            assert original[n].get_text() == combined[n].get_text(), f"Archived page {n+1} changed"
            def actions(page):
                return [{k:v for k,v in link.items() if k not in ("id","xref")} for link in page.get_links()]
            assert actions(original[n]) == actions(combined[n]), f"Archived link target changed on {n+1}"
        toc = combined.get_toc()
        assert all(entry in toc for entry in original.get_toc())
        for title, page in chapters:
            assert any(entry[1]==title and entry[2]==archive_count+page for entry in toc)
        assert len(toc) >= len(original.get_toc())+len(chapters)+1
        assert combined[archive_count].get_text().find("The AERIS") >= 0
        thumbs = []
        for n in range(archive_count, len(combined)):
            png = TMP / f"page-{n+1}.png"
            poppler = shutil.which("pdftoppm")
            if poppler:
                subprocess.run([poppler,"-f",str(n+1),"-l",str(n+1),"-r","120","-png","-singlefile",str(output),str(png.with_suffix(""))],check=True)
            else:
                combined[n].get_pixmap(dpi=120,alpha=False).save(str(png))
            with Image.open(png) as image:
                small=image.convert("RGB")
                small.thumbnail((290,410))
                thumbs.append((n+1,small.copy()))
        sheet=Image.new("RGB",(310*min(3,len(thumbs)),445*((len(thumbs)+2)//3)),"#d7d5d4")
        draw=ImageDraw.Draw(sheet)
        for i,(n,image) in enumerate(thumbs):
            x,y=(i%3)*310+9,(i//3)*445+8
            sheet.paste(image,(x,y))
            draw.text((x,y+412),f"Page {n}",fill="#192c43")
        sheet.save(TMP / "contact-sheet.jpg",quality=88)


def main():
    TMP.mkdir(parents=True,exist_ok=True)
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    original_digest = hashlib.sha256(BASE.read_bytes()).hexdigest()
    chapter = TMP / "milestone-2-pages.pdf"
    count = len(PdfReader(BASE).pages)
    chapters = write_new_pages(count, chapter)
    writer = PdfWriter(clone_from=BASE)
    writer.append(chapter,import_outline=False)
    writer.add_metadata({"/Title":"AERIS · Travel Planning and Booking Platform | Project handbook","/Subject":"Milestones 1 and 2"})
    root = writer.get_outline_root()
    start = writer.add_outline_item(title="Milestone 2 · Frontend and final integration",page_number=count,before=root.get("/First"),bold=True)
    for title, page in chapters:
        writer.add_outline_item(title=title,page_number=count+page-1,parent=start)
    writer.open_destination = writer.pages[count]
    draft = TMP / "combined.pdf"
    with draft.open("wb") as out:
        writer.write(out)
    verify_and_render(count,draft,chapters)
    assert hashlib.sha256(BASE.read_bytes()).hexdigest()==original_digest
    shutil.copyfile(draft,OUTPUT)
    print(f"{OUTPUT} ({len(writer.pages)} pages, {count} archived, {len(chapters)} frontend sections)")


if __name__ == "__main__":
    main()

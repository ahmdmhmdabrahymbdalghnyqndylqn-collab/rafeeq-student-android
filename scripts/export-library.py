import json, re
from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageDraw

root = Path(__file__).resolve().parents[1]
rows = json.loads((root/'output/pdf/manifest.json').read_text(encoding='utf-8'))
dest = root/'public/book-covers'
dest.mkdir(parents=True, exist_ok=True)
catalog = []
thumbs = []
for row in rows:
    doc = pdfium.PdfDocument(row['source'])
    page = doc[1]
    img = page.render(scale=1).to_pil().convert('RGB')
    img.thumbnail((480,680),Image.Resampling.LANCZOS)
    img.save(dest/f"book-{row['id']:03d}.webp",quality=82)
    thumb = Image.new('RGB',(140,210),'white')
    fitted = ImageOps.contain(img,(132,182))
    thumb.paste(fitted,((140-fitted.width)//2,0))
    ImageDraw.Draw(thumb).text((8,190),str(row['id']),fill='black')
    thumbs.append(thumb)
    title = re.sub(r'\s+',' ',row['title'].replace('_',' ')).strip()
    catalog.append({k:row[k] for k in ['id','subject','country','objectKey','size','pages']} | {'title':title,'cover':f"/book-covers/book-{row['id']:03d}.webp",'previewPage':2,'previewKind':'page' if row['id'] in [2,5] else 'cover'})
    page.close()
    doc.close()
(root/'public/library-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
sheet = Image.new('RGB',(140*9,210*6),'#eee')
for i,thumb in enumerate(thumbs): sheet.paste(thumb,((i%9)*140,(i//9)*210))
sheet.save(root/'tmp/pdfs/cover-contact-sheet.jpg')
print(f'Exported {len(catalog)} real first-page covers; total {sum(p.stat().st_size for p in dest.glob("*.webp"))} bytes')

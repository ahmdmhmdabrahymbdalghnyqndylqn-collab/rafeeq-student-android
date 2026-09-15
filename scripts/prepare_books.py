import json, os, re, sys, time, shutil, logging, warnings
from pathlib import Path
from PIL import Image
from pypdf import PdfReader, PdfWriter
logging.getLogger("pypdf").setLevel(logging.ERROR);warnings.filterwarnings("ignore")

source=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
sys.stdout.reconfigure(encoding="utf-8")
manifest_path=out/"manifest.json"
manifest=json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
for row in manifest:
    src,tgt=Path(row["source"]),Path(row["prepared"])
    if tgt.exists() and tgt.stat().st_size>=src.stat().st_size:
        shutil.copy2(src,tgt);row["size"]=tgt.stat().st_size;row["optimizedImages"]=0
if manifest: manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
def subject(name):
    for key,label in [("فيزياء","الفيزياء"),("كيمياء","الكيمياء"),("احياء","الأحياء"),("أحياء","الأحياء"),("عربي","اللغة العربية"),("نحو","اللغة العربية"),("بلاغ","اللغة العربية"),("ادب","اللغة العربية"),("إنجليزي","اللغة الإنجليزية"),("انجليزي","اللغة الإنجليزية"),("تاريخ","التاريخ"),("جغرافيا","الجغرافيا"),("بحته","الرياضيات البحتة"),("تطبيقي","الرياضيات التطبيقية")]:
        if key in name:return label
    return "عام"
for idx,path in enumerate(sorted(source.glob("*.pdf")),1):
    target=out/f"book-{idx:03d}.pdf"; started=time.time()
    if any(x["id"]==idx for x in manifest):
        continue
    reader=PdfReader(path,strict=False)
    if path.stat().st_size < 230*1024*1024:
        shutil.copy2(path,target)
        row={"id":idx,"title":path.stem.strip(),"subject":subject(path.stem),"country":"egypt","objectKey":f"books/egypt/{target.name}","source":str(path),"prepared":str(target),"originalSize":path.stat().st_size,"size":target.stat().st_size,"pages":len(reader.pages),"optimizedImages":0}
        manifest.append(row);print(json.dumps({"done":idx,"title":row["title"],"mb":round(row["size"]/1048576,1),"seconds":round(time.time()-started,1)},ensure_ascii=False),flush=True)
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8");continue
    writer=PdfWriter(clone_from=reader)
    optimized=0
    for page in writer.pages:
        try: page.compress_content_streams()
        except Exception: pass
        try:
            for item in page.images:
                im=item.image
                if im.width*im.height>2_000_000:
                    if im.mode not in ("RGB","L"): im=im.convert("RGB")
                    im.thumbnail((1800,1800),Image.Resampling.LANCZOS)
                    item.replace(im,quality=72,optimize=True)
                    optimized+=1
        except Exception: pass
    try: writer.compress_identical_objects(remove_identicals=True,remove_orphans=True)
    except Exception: pass
    with target.open("wb") as f: writer.write(f)
    if target.stat().st_size >= path.stat().st_size:
        shutil.copy2(path,target)
    row={"id":idx,"title":path.stem.strip(),"subject":subject(path.stem),"country":"egypt","objectKey":f"books/egypt/{target.name}","source":str(path),"prepared":str(target),"originalSize":path.stat().st_size,"size":target.stat().st_size,"pages":len(reader.pages),"optimizedImages":optimized}
    manifest.append(row);print(json.dumps({"done":idx,"title":row["title"],"mb":round(row["size"]/1048576,1),"seconds":round(time.time()-started,1)},ensure_ascii=False),flush=True)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"complete":len(manifest),"bytes":sum(x["size"] for x in manifest)},ensure_ascii=False))

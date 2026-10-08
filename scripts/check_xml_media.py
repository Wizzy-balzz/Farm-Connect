import docx
import zipfile
import xml.etree.ElementTree as ET

doc_path = r"d:\MWTEL\myi-react-app\example-report\Store_Management_System_Report_Revised.docx"
doc = docx.Document(doc_path)

with zipfile.ZipFile(doc_path, 'r') as z:
    for name in z.namelist():
        if "media" in name or "image" in name:
            print("Zip media item:", name)

# Inspect XML elements in body for drawing / shape / w:drawing
xml_content = doc._body._element.xml
print("w:drawing count in XML:", xml_content.count("<w:drawing>"))
print("w:graphic count in XML:", xml_content.count("w:graphic"))
print("w:pict count in XML:", xml_content.count("w:pict"))
print("w:tbl count in XML:", xml_content.count("w:tbl"))

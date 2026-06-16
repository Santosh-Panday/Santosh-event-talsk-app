import urllib.request
import xml.etree.ElementTree as ET
import re
from html.parser import HTMLParser

class FeedHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
        self.current_type = None
        self.current_html = []
        self.current_text = []
        self.in_p = False
        self.in_h3 = False
        
    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            # If we were already building an item, save it
            self.save_current_item()
            self.in_h3 = True
            self.current_html = []
            self.current_text = []
        elif tag == 'p':
            self.in_p = True
            self.current_html.append("<p>")
        else:
            # Reconstruct other tags (like a, strong, code)
            attrs_str = "".join([f' {k}="{v}"' for k, v in attrs])
            self.current_html.append(f"<{tag}{attrs_str}>")

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.in_h3 = False
        elif tag == 'p':
            self.in_p = False
            self.current_html.append("</p>")
        else:
            self.current_html.append(f"</{tag}>")

    def handle_data(self, data):
        if self.in_h3:
            self.current_type = data.strip()
        else:
            self.current_html.append(data)
            self.current_text.append(data)

    def save_current_item(self):
        if self.current_type and self.current_html:
            html_str = "".join(self.current_html).strip()
            text_str = "".join(self.current_text).strip()
            # Clean up whitespace
            text_str = re.sub(r'\s+', ' ', text_str)
            self.items.append({
                'type': self.current_type,
                'html': html_str,
                'text': text_str
            })
            self.current_html = []
            self.current_text = []

    def parse(self, html_content):
        self.items = []
        self.current_type = None
        self.current_html = []
        self.current_text = []
        self.feed(html_content)
        self.save_current_item() # Save the last item
        return self.items

url = "https://cloud.google.com/feeds/bigquery-release-notes.xml"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read()
        root = ET.fromstring(content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', ns)
        
        parser = FeedHTMLParser()
        for entry in entries[:2]:
            title = entry.find('atom:title', ns).text
            updated = entry.find('atom:updated', ns).text
            link = entry.find('atom:link', ns).attrib.get('href', '')
            html_content = entry.find('atom:content', ns).text
            
            parsed_items = parser.parse(html_content)
            print(f"\nDate: {title} | Link: {link}")
            print(f"Parsed {len(parsed_items)} items:")
            for idx, item in enumerate(parsed_items):
                print(f"  Item {idx+1}:")
                print(f"    Type: {item['type']}")
                print(f"    Text: {item['text'][:150]}...")
                print(f"    HTML: {item['html'][:150]}...")
except Exception as e:
    import traceback
    traceback.print_exc()

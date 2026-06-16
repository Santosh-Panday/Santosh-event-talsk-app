import os
import urllib.request
import xml.etree.ElementTree as ET
import re
import time
from html.parser import HTMLParser
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Memory cache for release notes
CACHE = {
    'items': None,
    'last_updated': 0
}
CACHE_TIMEOUT = 300  # 5 minutes cache

FEED_URL = "https://cloud.google.com/feeds/bigquery-release-notes.xml"

class FeedHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
        self.current_type = None
        self.current_html = []
        self.current_text = []
        self.h3_text = []
        self.in_h3 = False
        
    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self.save_current_item()
            self.in_h3 = True
            self.h3_text = []
            self.current_html = []
            self.current_text = []
        else:
            # Reconstruct the tag
            attrs_str = "".join([f' {k}="{v}"' for k, v in attrs])
            self.current_html.append(f"<{tag}{attrs_str}>")

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.in_h3 = False
            self.current_type = "".join(self.h3_text).strip()
        else:
            self.current_html.append(f"</{tag}>")

    def handle_data(self, data):
        if self.in_h3:
            self.h3_text.append(data)
        else:
            self.current_html.append(data)
            self.current_text.append(data)

    def save_current_item(self):
        html_str = "".join(self.current_html).strip()
        text_str = "".join(self.current_text).strip()
        
        # Clean up whitespace
        text_str = re.sub(r'\s+', ' ', text_str)
        
        # If type is not set, default to 'Update'
        item_type = self.current_type or "Update"
        
        if html_str or text_str:
            self.items.append({
                'type': item_type,
                'html': html_str,
                'text': text_str
            })
            
    def parse(self, html_content):
        self.items = []
        self.current_type = None
        self.current_html = []
        self.current_text = []
        self.h3_text = []
        self.in_h3 = False
        
        self.feed(html_content)
        self.save_current_item()  # Save last item
        return self.items

def fetch_and_parse_feed():
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    with urllib.request.urlopen(req) as response:
        xml_content = response.read()
    
    root = ET.fromstring(xml_content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = root.findall('atom:entry', ns)
    
    parsed_entries = []
    parser = FeedHTMLParser()
    
    for entry_idx, entry in enumerate(entries):
        title = entry.find('atom:title', ns)
        date_str = title.text if title is not None else "Unknown Date"
        
        updated_tag = entry.find('atom:updated', ns)
        updated_str = updated_tag.text if updated_tag is not None else ""
        
        link_tag = entry.find('atom:link', ns)
        link_href = link_tag.attrib.get('href', '') if link_tag is not None else ""
        
        content_tag = entry.find('atom:content', ns)
        html_content = content_tag.text if content_tag is not None else ""
        
        # Parse the HTML content into individual update items
        items = parser.parse(html_content)
        
        for item_idx, item in enumerate(items):
            # Create a unique ID for each item
            unique_id = f"item_{entry_idx}_{item_idx}"
            parsed_entries.append({
                'id': unique_id,
                'date': date_str,
                'updated': updated_str,
                'link': link_href,
                'type': item['type'],
                'html': item['html'],
                'text': item['text']
            })
            
    return parsed_entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or CACHE['items'] is None or (now - CACHE['last_updated'] > CACHE_TIMEOUT):
        try:
            items = fetch_and_parse_feed()
            CACHE['items'] = items
            CACHE['last_updated'] = now
            return jsonify({
                'status': 'success',
                'source': 'network',
                'updated_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(now)),
                'data': items
            })
        except Exception as e:
            # Fallback to cache if available
            if CACHE['items'] is not None:
                return jsonify({
                    'status': 'warning',
                    'message': f"Failed to fetch fresh data: {str(e)}. Showing cached version.",
                    'source': 'cache_fallback',
                    'updated_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(CACHE['last_updated'])),
                    'data': CACHE['items']
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': f"Failed to fetch release notes: {str(e)}",
                    'data': []
                }), 500
                
    return jsonify({
        'status': 'success',
        'source': 'cache',
        'updated_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(CACHE['last_updated'])),
        'data': CACHE['items']
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

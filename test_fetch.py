import urllib.request
import xml.etree.ElementTree as ET

url = "https://cloud.google.com/feeds/bigquery-release-notes.xml"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read()
        root = ET.fromstring(content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', ns)
        print(f"Total entries found: {len(entries)}")
        for i, entry in enumerate(entries[:3]):
            title = entry.find('atom:title', ns).text
            updated = entry.find('atom:updated', ns).text
            html_content = entry.find('atom:content', ns).text
            print(f"\n--- Entry {i+1} ---")
            print(f"Title/Date: {title}")
            print(f"Updated: {updated}")
            print("HTML Content:")
            print(html_content[:1000]) # Print first 1000 chars of HTML
            if len(html_content) > 1000:
                print("... [TRUNCATED]")
except Exception as e:
    print("Error:", str(e))

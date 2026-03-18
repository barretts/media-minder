"""Debug: inspect IMDB search HTML structure."""
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

url = "https://www.imdb.com/find/?q=Dinosaur+Valley+Girls+1996&s=tt&ttype=ft"
print(f"Fetching: {url}\n")
resp = requests.get(url, headers=HEADERS, timeout=15)
print(f"Status: {resp.status_code}")

soup = BeautifulSoup(resp.text, "lxml")

# Check selectors
items = soup.select(".ipc-metadata-list-summary-item")
print(f"\n.ipc-metadata-list-summary-item: {len(items)}")

for i, item in enumerate(items[:3]):
    print(f"\n--- Item {i} HTML (800 chars) ---")
    print(str(item)[:800])
    print(f"\n  All text: {item.get_text(' | ', strip=True)[:200]}")
    links = item.select("a")
    for a in links:
        print(f"  link: href={a.get('href', '')[:60]} text='{a.get_text(strip=True)[:60]}'")


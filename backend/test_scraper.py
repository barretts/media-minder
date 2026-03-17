"""Test TMDB + IMDB scrapers — run with: python test_scraper.py"""

from scraper import tmdb_search, tmdb_movie_details, imdb_search, imdb_movie_details

print("=== Testing TMDB API ===\n")

print("1. TMDB search 'The Matrix 1999'...")
results = tmdb_search("The Matrix", 1999)
print(f"   Found {len(results)} results")
if results:
    r = results[0]
    print(f"   First: \"{r['title']}\" ({r['year']}) ID:{r['id']}")

print("\n=== Testing IMDB Scraping ===\n")

print("2. IMDB search 'Dinosaur Valley Girls 1996'...")
results = imdb_search("Dinosaur Valley Girls", 1996)
print(f"   Found {len(results)} results")
for r in results[:3]:
    print(f"   - \"{r['title']}\" ({r['year']}) {r['imdbId']}")

print("\n3. IMDB search 'Helen Rogers'...")
results = imdb_search("Helen Rogers")
print(f"   Found {len(results)} results")
for r in results[:3]:
    print(f"   - \"{r['title']}\" ({r['year']}) {r['imdbId']}")

print("\n4. IMDB details for tt0116040 (Dinosaur Valley Girls)...")
d = imdb_movie_details("tt0116040")
if d:
    print(f"   Title: \"{d['title']}\"")
    print(f"   Year: {d['year']}, Rating: {d['rating']}, Runtime: {d['runtime']}min")
    print(f"   MPAA: {d['mpaa']}")
    print(f"   Genres: {', '.join(d['genres'])}")
    print(f"   Directors: {', '.join(d['directors'])}")
    print(f"   Actors ({len(d['actors'])}): {', '.join(a['name'] for a in d['actors'][:5])}")
    print(f"   Poster: {'yes' if d['posterUrl'] else 'no'}")
    print(f"   Plot: {d['plot'][:120]}...")
else:
    print("   FAILED")

print("\n=== Done ===")

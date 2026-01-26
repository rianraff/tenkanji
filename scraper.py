import requests
import json
import time
import random
from bs4 import BeautifulSoup
from tqdm import tqdm

def scrape_jlpt5_list():
    base_url = "https://www.japandict.com/lists/jlpt/jlpt5?page="
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    
    all_words_data = []
    total_pages = 65

    print(f"Starting crawl for {total_pages} pages...")
    
    for page in tqdm(range(1, total_pages + 1), desc="Scraping Pages"):
        url = f"{base_url}{page}"
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            target_tags = soup.find_all('a', class_="list-group-item list-group-item-action my-2 mdshadow-1")
            
            for tag in target_tags:
                word_elem = tag.find('span', class_='xlarge text-normal me-4')
                word = word_elem.get_text(strip=True) if word_elem else "N/A"
                
                hiragana_elem = tag.find('span', class_='text-muted me-4')
                hiragana = hiragana_elem.get_text(strip=True) if hiragana_elem else "N/A"
                
                romaji_elem = tag.find('i', class_='text-muted xsmall')
                romaji = romaji_elem.get_text(strip=True) if romaji_elem else "N/A"
                
                meanings_ul = tag.find('ul', class_='list-unstyled ms-2 m-1')
                meanings = [li.get_text(strip=True) for li in meanings_ul.find_all('li')] if meanings_ul else []
                
                all_words_data.append({
                    "word": word,
                    "hiragana": hiragana,
                    "romaji": romaji,
                    "meanings": meanings,
                    "page": page
                })
            
            # Simple rate limiting to be polite to the server
            time.sleep(random.uniform(0.5, 1.5))

        except Exception as err:
            print(f"\nError on page {page}: {err}")
            continue

    # Save everything to a single JSON
    json_filename = "words.json"
    with open(json_filename, "w", encoding="utf-8") as f:
        json.dump(all_words_data, f, ensure_ascii=False, indent=4)
        
    print(f"\n✨ Done! Successfully saved {len(all_words_data)} total items to {json_filename}")

if __name__ == "__main__":
    scrape_jlpt5_list()

"""
Dumps app/sector_mapping.py's SECTOR_INDEX_MAP to web/src/data/sector_index_map.json
so the Next.js frontend (indices/[symbol] page - "stocks in this sector" table)
reads the same mapping Python uses, instead of duplicating it in TypeScript.

This is a static, manually-curated mapping (industry -> index symbol) that
only changes when someone edits SECTOR_INDEX_MAP by hand - re-run this
whenever that happens. Not part of the daily sync chain.
"""
import sys
import os
import json

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

from app.sector_mapping import SECTOR_INDEX_MAP

OUTPUT_JSON = os.path.join(base_dir, 'web', 'src', 'data', 'sector_index_map.json')

if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(SECTOR_INDEX_MAP, f, indent=2, sort_keys=True)
    print(f"Wrote {len(SECTOR_INDEX_MAP)} industry -> sector index mappings to {OUTPUT_JSON}")

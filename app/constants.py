"""Application constants"""

# Rate limiting
RATE_LIMIT_DELAY_SECONDS = 0.5

# Data validation
DATA_MISMATCH_THRESHOLD = 0.10  # 10% difference triggers full resync (catches splits/bonuses, ignores dividend adjustments)
VALIDATION_RECORDS_COUNT = 60  # Number of records to check for validation

# File paths
CSV_FILENAME = "ind_niftytotalmarket_list.csv"
EQUITY_LIST_FILENAME = "EQUITY_LIST_6_1_2026.csv"
FULL_EQUITY_LIST_FILENAME = "EQUITY_LIST_27-3-26.csv"


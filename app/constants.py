"""Application constants"""

# Rate limiting
RATE_LIMIT_DELAY_SECONDS = 0.5

# Data validation
DATA_MISMATCH_THRESHOLD = 0.01  # 1% difference triggers full resync
VALIDATION_RECORDS_COUNT = 5  # Number of records to check for validation

# File paths
CSV_FILENAME = "ind_niftytotalmarket_list.csv"
EQUITY_LIST_FILENAME = "Equity_List.csv"


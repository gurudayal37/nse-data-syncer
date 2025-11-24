import sys
import os
from dotenv import load_dotenv

# Load env first
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, 'web', '.env'))

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.momentum import calculate_momentum

if __name__ == "__main__":
    calculate_momentum()

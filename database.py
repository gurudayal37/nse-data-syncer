import os
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, BigInteger, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import SQLAlchemyError
import pandas as pd
from datetime import datetime

# Database URL
# Use environment variable for security, fallback to hardcoded for local dev if needed (though better to use env var always)
DB_URL = os.getenv('DATABASE_URL')

if not DB_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

Base = declarative_base()

class DailyPrice(Base):
    __tablename__ = 'daily_prices'
    # Using the existing schema structure
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, nullable=False)
    date = Column(DateTime, nullable=False)
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    volume = Column(BigInteger)
    # Other columns can be ignored or added if needed, but for insertion we only care about these.
    # If the table has NOT NULL constraints on other columns, we might have issues.
    # Based on inspection, only id, stock_id, date seem critical. 

class Stock(Base):
    __tablename__ = 'stocks'
    id = Column(Integer, primary_key=True)
    nse_symbol = Column(String)

class DatabaseManager:
    def __init__(self, db_url=DB_URL):
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)

    def get_symbol_map(self):
        """Returns a dictionary mapping NSE symbol to stock_id."""
        session = self.Session()
        try:
            stocks = session.query(Stock.nse_symbol, Stock.id).all()
            return {s.nse_symbol: s.id for s in stocks if s.nse_symbol}
        except SQLAlchemyError as e:
            print(f"Error fetching symbol map: {e}")
            return {}
        finally:
            session.close()

    def get_last_synced_date(self, stock_id):
        """Returns the latest date available for a given stock_id."""
        session = self.Session()
        try:
            result = session.query(DailyPrice.date).filter(DailyPrice.stock_id == stock_id).order_by(DailyPrice.date.desc()).first()
            return result[0].date() if result else None
        except SQLAlchemyError as e:
            print(f"Error fetching last date for stock_id {stock_id}: {e}")
            return None
        finally:
            session.close()

    def bulk_insert(self, df, stock_id):
        """Inserts a pandas DataFrame into the database."""
        if df.empty:
            return

        # Prepare DataFrame for insertion
        df_to_insert = df.reset_index().copy()
        
        # Rename columns to match existing schema
        # Yahoo: Date, Open, High, Low, Close, Volume
        # DB: date, open_price, high_price, low_price, close_price, volume
        
        df_to_insert = df_to_insert.rename(columns={
            'Date': 'date',
            'Open': 'open_price',
            'High': 'high_price',
            'Low': 'low_price',
            'Close': 'close_price',
            'Volume': 'volume'
        })
        
        df_to_insert['stock_id'] = stock_id
        df_to_insert['created_at'] = datetime.now()
        
        # Select only relevant columns
        columns = ['stock_id', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume', 'created_at']
        df_to_insert = df_to_insert[columns]

        try:
            df_to_insert.to_sql('daily_prices', self.engine, if_exists='append', index=False, method='multi', chunksize=1000)
            print(f"Inserted {len(df_to_insert)} records for stock_id {stock_id}")
        except SQLAlchemyError as e:
            print(f"Error inserting data for stock_id {stock_id}: {e}")

import os
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, BigInteger, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import SQLAlchemyError
import pandas as pd
from datetime import datetime, timedelta

# Database URL from environment variable
DB_URL = os.getenv('DATABASE_URL')

if not DB_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

Base = declarative_base()

class DailyPrice(Base):
    __tablename__ = 'daily_prices'
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, nullable=False)
    date = Column(DateTime, nullable=False)
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    volume = Column(BigInteger) 

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

    def insert_stock(self, symbol, details):
        """
        Inserts a new stock into the stocks table.
        Returns the stock_id if successful, None otherwise.
        """
        session = self.Session()
        try:
            # Check if it already exists
            existing_stock = session.execute(
                text("SELECT id FROM stocks WHERE nse_symbol = :symbol"),
                {"symbol": symbol}
            ).fetchone()
            
            if existing_stock:
                return existing_stock[0]

            query = text("""
                INSERT INTO stocks (nse_symbol, name, isin) 
                VALUES (:symbol, :name, :isin) 
                RETURNING id
            """)
            
            result = session.execute(query, {
                "symbol": symbol, 
                "name": details.get('name'), 
                "isin": details.get('isin')
            })
            stock_id = result.fetchone()[0]
            session.commit()
            print(f"Inserted new stock: {symbol} (ID: {stock_id})")
            return stock_id
        except Exception as e:
            session.rollback()
            print(f"Error inserting stock {symbol}: {e}")
            return None
        finally:
            session.close()

    def get_last_n_records(self, stock_id, n=5):
        """
        Fetches the last n records for a stock to validate against new data.
        Returns a dict: {date: close_price}
        """
        session = self.Session()
        try:
            query = text("""
                SELECT date, close_price 
                FROM daily_prices 
                WHERE stock_id = :stock_id 
                ORDER BY date DESC 
                LIMIT :limit
            """)
            result = session.execute(query, {"stock_id": stock_id, "limit": n}).fetchall()
            return {row[0]: row[1] for row in result}
        except Exception as e:
            print(f"Error fetching last records for stock {stock_id}: {e}")
            return {}
        finally:
            session.close()

    def delete_daily_prices(self, stock_id):
        """
        Deletes all daily prices for a given stock_id.
        Used when a full resync is required (e.g., corporate action).
        """
        session = self.Session()
        try:
            query = text("DELETE FROM daily_prices WHERE stock_id = :stock_id")
            session.execute(query, {"stock_id": stock_id})
            session.commit()
            print(f"Deleted all records for stock_id {stock_id}")
        except Exception as e:
            session.rollback()
            print(f"Error deleting records for stock {stock_id}: {e}")
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

    def insert_daily_prices(self, stock_id, df):
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

    def update_performance_metrics(self, stock_id):
        """
        Calculates and updates performance metrics (1w, 1m, 3m, 6m, 1y, 3y, 5y) for a stock.
        """
        session = self.Session()
        try:
            # Get latest date and price
            latest_record = session.query(DailyPrice.date, DailyPrice.close_price)\
                .filter(DailyPrice.stock_id == stock_id)\
                .order_by(DailyPrice.date.desc())\
                .first()
            
            if not latest_record:
                return

            latest_date, latest_price = latest_record
            
            # Get latest volume
            latest_volume_record = session.query(DailyPrice.volume)\
                .filter(DailyPrice.stock_id == stock_id)\
                .order_by(DailyPrice.date.desc())\
                .first()
            latest_volume = latest_volume_record[0] if latest_volume_record else None
            
            # Define time deltas
            deltas = {
                '1w': timedelta(weeks=1),
                '1m': timedelta(days=30),
                '3m': timedelta(days=90),
                '6m': timedelta(days=180),
                '1y': timedelta(days=365),
                '3y': timedelta(days=1095),
                '5y': timedelta(days=1825)
            }
            
            metrics = {}
            
            for period, delta in deltas.items():
                target_date = latest_date - delta
                
                # Find nearest record on or before target_date
                past_record = session.query(DailyPrice.close_price)\
                    .filter(DailyPrice.stock_id == stock_id)\
                    .filter(DailyPrice.date <= target_date)\
                    .order_by(DailyPrice.date.desc())\
                    .first()
                
                if past_record:
                    past_price = past_record[0]
                    if past_price:
                        change = ((latest_price - past_price) / past_price) * 100
                        metrics[f'change_{period}'] = change
                    else:
                        metrics[f'change_{period}'] = None
                else:
                    metrics[f'change_{period}'] = None

            # Upsert into stock_performance
            # Check if record exists
            perf_record = session.query(StockPerformance).filter_by(stock_id=stock_id).first()
            
            if not perf_record:
                perf_record = StockPerformance(stock_id=stock_id)
                session.add(perf_record)
            
            perf_record.change_1w = metrics.get('change_1w')
            perf_record.change_1m = metrics.get('change_1m')
            perf_record.change_3m = metrics.get('change_3m')
            perf_record.change_6m = metrics.get('change_6m')
            perf_record.change_1y = metrics.get('change_1y')
            perf_record.change_3y = metrics.get('change_3y')
            perf_record.change_5y = metrics.get('change_5y')
            perf_record.daily_volume = latest_volume
            perf_record.updated_at = datetime.now()
            
            session.commit()
            
        except Exception as e:
            session.rollback()
            print(f"Error updating performance for stock {stock_id}: {e}")
        finally:
            session.close()

class StockPerformance(Base):
    __tablename__ = 'stock_performance'
    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, nullable=False, unique=True)
    change_1w = Column(Float)
    change_1m = Column(Float)
    change_3m = Column(Float)
    change_6m = Column(Float)
    change_1y = Column(Float)
    change_3y = Column(Float)
    change_5y = Column(Float)
    daily_volume = Column(BigInteger)
    updated_at = Column(DateTime, default=datetime.now)

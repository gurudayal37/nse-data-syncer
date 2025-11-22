import { PrismaClient } from './src/generated/client/client.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Not set ❌');
    
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('Result:', result);
    
    // Test fetching stocks count
    const stockCount = await prisma.stocks.count();
    console.log(`📊 Found ${stockCount} stocks in database`);
    
    // Test fetching a sample stock
    const sampleStock = await prisma.stocks.findFirst({
      select: { id: true, nse_symbol: true, name: true }
    });
    if (sampleStock) {
      console.log('📈 Sample stock:', sampleStock);
    }
    
    // Test fetching daily prices
    const priceCount = await prisma.daily_prices.count();
    console.log(`💰 Found ${priceCount} daily price records`);
    
    await prisma.$disconnect();
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    console.error('\nFull error details:');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();


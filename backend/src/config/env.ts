import dotenv from 'dotenv';
import path from 'path';

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';

dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
};

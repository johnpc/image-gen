import { NextResponse } from 'next/server';

export async function GET() {
  // Debug environment variables (be careful not to expose secrets in production)
  const envDebug = {
    NODE_ENV: process.env.NODE_ENV,
    AWS_REGION: process.env.AWS_REGION ? 'SET' : 'NOT_SET',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? `SET (length: ${process.env.AWS_ACCESS_KEY_ID.length})` : 'NOT_SET',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? `SET (length: ${process.env.AWS_SECRET_ACCESS_KEY.length})` : 'NOT_SET',
    APP_AWS_REGION: process.env.APP_AWS_REGION ? 'SET' : 'NOT_SET',
    APP_AWS_ACCESS_KEY_ID: process.env.APP_AWS_ACCESS_KEY_ID ? `SET (length: ${process.env.APP_AWS_ACCESS_KEY_ID.length})` : 'NOT_SET',
    APP_AWS_SECRET_ACCESS_KEY: process.env.APP_AWS_SECRET_ACCESS_KEY ? `SET (length: ${process.env.APP_AWS_SECRET_ACCESS_KEY.length})` : 'NOT_SET',
    
    // Show first few characters of access keys for debugging (safe for logs)
    AWS_ACCESS_KEY_ID_PREFIX: process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 4) + '...' : 'NOT_SET',
    APP_AWS_ACCESS_KEY_ID_PREFIX: process.env.APP_AWS_ACCESS_KEY_ID ? process.env.APP_AWS_ACCESS_KEY_ID.substring(0, 4) + '...' : 'NOT_SET',
    
    // Additional environment info
    VERCEL: process.env.VERCEL ? 'SET' : 'NOT_SET',
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME ? 'SET' : 'NOT_SET',
    AWS_EXECUTION_ENV: process.env.AWS_EXECUTION_ENV || 'NOT_SET',
    
    // All environment variables starting with AWS or APP (keys only, no values)
    AWS_VARS: Object.keys(process.env).filter(key => key.startsWith('AWS_')),
    APP_VARS: Object.keys(process.env).filter(key => key.startsWith('APP_')),
  };

  return NextResponse.json({
    success: true,
    environment: envDebug,
    timestamp: new Date().toISOString(),
  });
}

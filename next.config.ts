import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure environment variables are available at build time
  env: {
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    APP_AWS_REGION: process.env.APP_AWS_REGION,
    APP_AWS_ACCESS_KEY_ID: process.env.APP_AWS_ACCESS_KEY_ID,
    APP_AWS_SECRET_ACCESS_KEY: process.env.APP_AWS_SECRET_ACCESS_KEY,
  },
  
  // External packages that should not be bundled
  serverExternalPackages: ['@aws-sdk/client-bedrock-runtime'],
  
  // Output configuration for better Amplify compatibility
  output: 'standalone',
  
  // Disable static optimization for API routes to ensure they run server-side
  trailingSlash: false,
  
  // Ensure proper handling of environment variables in different environments
  publicRuntimeConfig: {
    // These will be available on both client and server
    // Don't put sensitive data here
  },
  
  serverRuntimeConfig: {
    // These will only be available on the server-side
    // This is where sensitive data should go, but we're handling it via process.env directly
  },
};

export default nextConfig;

// Debug script to test AWS authentication
const { BedrockRuntimeClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock-runtime');

async function debugAuth() {
    console.log('=== AWS Authentication Debug ===');
    
    // Check environment variables
    console.log('Environment Variables:');
    console.log('APP_AWS_ACCESS_KEY_ID:', process.env.APP_AWS_ACCESS_KEY_ID ? 'SET (length: ' + process.env.APP_AWS_ACCESS_KEY_ID.length + ')' : 'NOT SET');
    console.log('APP_AWS_SECRET_ACCESS_KEY:', process.env.APP_AWS_SECRET_ACCESS_KEY ? 'SET (length: ' + process.env.APP_AWS_SECRET_ACCESS_KEY.length + ')' : 'NOT SET');
    console.log('APP_AWS_REGION:', process.env.APP_AWS_REGION || 'NOT SET');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET (length: ' + process.env.AWS_ACCESS_KEY_ID.length + ')' : 'NOT SET');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET (length: ' + process.env.AWS_SECRET_ACCESS_KEY.length + ')' : 'NOT SET');
    console.log('AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
    
    // Test different credential configurations
    const configs = [
        {
            name: 'APP_ prefixed credentials',
            config: {
                region: process.env.APP_AWS_REGION || 'us-east-1',
                credentials: process.env.APP_AWS_ACCESS_KEY_ID ? {
                    accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
                } : undefined
            }
        },
        {
            name: 'Standard AWS credentials',
            config: {
                region: process.env.AWS_REGION || 'us-east-1',
                credentials: process.env.AWS_ACCESS_KEY_ID ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                } : undefined
            }
        },
        {
            name: 'Default credential chain',
            config: {
                region: 'us-east-1'
            }
        }
    ];
    
    for (const { name, config } of configs) {
        console.log(`\n=== Testing ${name} ===`);
        
        if (config.credentials) {
            console.log('Using explicit credentials');
            console.log('Access Key ID starts with:', config.credentials.accessKeyId?.substring(0, 4) + '...');
            console.log('Secret Key length:', config.credentials.secretAccessKey?.length);
        } else {
            console.log('Using default credential chain');
        }
        
        try {
            const client = new BedrockRuntimeClient(config);
            const command = new ListFoundationModelsCommand({});
            const response = await client.send(command);
            console.log('✅ SUCCESS - Found', response.modelSummaries?.length || 0, 'models');
            
            // Show first few models
            if (response.modelSummaries?.length > 0) {
                console.log('Sample models:', response.modelSummaries.slice(0, 3).map(m => m.modelId));
            }
            break; // Stop on first success
        } catch (error) {
            console.log('❌ FAILED:', error.message);
            if (error.name === 'UnrecognizedClientException') {
                console.log('   → This suggests invalid credentials');
            } else if (error.name === 'TokenRefreshRequiredError') {
                console.log('   → This suggests expired temporary credentials');
            } else if (error.name === 'CredentialsProviderError') {
                console.log('   → This suggests credential provider issues');
            }
        }
    }
    
    // Additional checks
    console.log('\n=== Additional Checks ===');
    
    // Check if credentials look like temporary credentials
    const accessKey = process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    if (accessKey) {
        if (accessKey.startsWith('ASIA')) {
            console.log('⚠️  Detected temporary credentials (starts with ASIA)');
            console.log('   → These expire and may need refresh');
        } else if (accessKey.startsWith('AKIA')) {
            console.log('✅ Detected long-term IAM user credentials (starts with AKIA)');
        } else {
            console.log('❓ Unknown credential format');
        }
    }
    
    // Check system time (approximate)
    const now = new Date();
    console.log('Current system time:', now.toISOString());
    console.log('Time zone offset:', now.getTimezoneOffset(), 'minutes');
}

// Run if called directly
if (require.main === module) {
    debugAuth().catch(console.error);
}

module.exports = { debugAuth };

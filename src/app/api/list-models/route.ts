import { NextResponse } from 'next/server';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

// Use explicit credentials if provided, otherwise use default credential chain
// Support both standard AWS env vars and APP_ prefixed vars for Amplify deployment
const clientConfig: {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
} = {
  region: process.env.AWS_REGION || process.env.APP_AWS_REGION || 'us-east-1',
};

// Check for APP_ prefixed environment variables first (for Amplify deployment)
if (process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
  };
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  // Fallback to standard AWS environment variables (for local development)
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const client = new BedrockClient(clientConfig);

export async function GET() {
  try {
    const command = new ListFoundationModelsCommand({
      byOutputModality: 'IMAGE',
    });

    const response = await client.send(command);
    
    // Filter models to only include those that support on-demand throughput
    const imageModels = response.modelSummaries?.filter(model => {
      // Only include models that support IMAGE output
      const supportsImageOutput = model.outputModalities?.includes('IMAGE');
      
      // Only include models that support ON_DEMAND inference
      const supportsOnDemand = model.inferenceTypesSupported?.includes('ON_DEMAND');
      
      return supportsImageOutput && supportsOnDemand;
    }) || [];

    console.log(`Found ${response.modelSummaries?.length || 0} total models, filtered to ${imageModels.length} on-demand compatible models`);
    
    return NextResponse.json({
      success: true,
      models: imageModels.map(model => ({
        modelId: model.modelId,
        modelName: model.modelName,
        providerName: model.providerName,
        inputModalities: model.inputModalities,
        outputModalities: model.outputModalities,
        inferenceTypesSupported: model.inferenceTypesSupported,
      })),
      totalModels: response.modelSummaries?.length || 0,
      filteredModels: imageModels.length,
      filterReason: 'Only showing models that support ON_DEMAND inference type'
    });

  } catch (error) {
    console.error('Error listing models:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to list models', 
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'This could be due to AWS credentials, region configuration, or Bedrock service availability. Check your AWS setup and try again.'
      },
      { status: 500 }
    );
  }
}

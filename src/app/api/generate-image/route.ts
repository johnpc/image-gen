import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

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

const client = new BedrockRuntimeClient(clientConfig);

// Model ID mappings - Conservative list with commonly available models
const MODEL_IDS = {
  'sd3-large': 'stability.sd3-large-v1:0',
  'sd3.5-large': 'stability.stable-diffusion-xl-v1:0',
  'stable-ultra-v1.0': 'stability.stable-image-ultra-v1:0',
  'stable-ultra-v1.1': 'stability.stable-image-ultra-v1:0',
  'stable-core-v1.0': 'stability.stable-image-core-v1:0',
  'stable-core-v1.1': 'stability.stable-image-core-v1:0',
  'titan-g1': 'amazon.titan-image-generator-v1',
  'titan-g1-v2': 'amazon.titan-image-generator-v1', // Using v1 as v2 might not be available
  'nova-canvas': 'amazon.nova-canvas-v1:0',
};

// Function to get model ID - first try the mapping, then use the value directly
const getModelId = (modelValue: string): string => {
  // If it's already a full model ID (contains dots or colons), use it directly
  if (modelValue.includes('.') || modelValue.includes(':')) {
    return modelValue;
  }
  
  // Otherwise, use the legacy mapping for backward compatibility
  return MODEL_IDS[modelValue as keyof typeof MODEL_IDS] || modelValue;
};

interface ImageGenerationConfig {
  numberOfImages: number;
  height: number;
  width: number;
  cfgScale: number;
  seed?: number;
}

interface StabilityPayload {
  text_prompts: Array<{ text: string; weight: number }>;
  cfg_scale: number;
  steps: number;
  seed: number;
  width: number;
  height: number;
  init_image?: string;
  image_strength?: number;
}

interface TitanPayload {
  taskType: string;
  textToImageParams?: {
    text: string;
    negativeText?: string;
  };
  imageVariationParams?: {
    text: string;
    negativeText?: string;
    images: string[];
    similarityStrength: number;
  };
  imageGenerationConfig: ImageGenerationConfig;
}

type ModelPayload = StabilityPayload | TitanPayload;

export async function POST(request: NextRequest) {
  let model: string = '';
  let isStabilityModel = false;
  
  try {
    const body = await request.json();
    const { model: requestModel, positivePrompt, negativePrompt, inputImage, imageStrength, ...otherParams } = body;
    
    model = requestModel;
    isStabilityModel = model.startsWith('stability.') || model.startsWith('stable') || model === 'sd3-large' || model === 'sd3.5-large';

    console.log('Request received:', { model, positivePrompt, negativePrompt, hasInputImage: !!inputImage, imageStrength, otherParams });
    console.log('Environment check:', {
      region: process.env.AWS_REGION,
      credentialSource: process.env.AWS_ACCESS_KEY_ID ? 'environment_variables' : 'iam_role_or_default_chain',
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID?.substring(0, 8) + '...' || 'using_iam_role',
    });

    if (!model || !positivePrompt) {
      return NextResponse.json(
        { error: 'Model and positive prompt are required' },
        { status: 400 }
      );
    }

    const modelId = getModelId(model);
    if (!modelId) {
      return NextResponse.json(
        { error: 'Invalid model selected' },
        { status: 400 }
      );
    }

    // Validate and clamp CFG scale based on model type
    let cfgScale = otherParams.cfgScale || 7;
    
    if (isStabilityModel) {
      // Stability models support CFG scale up to 20
      cfgScale = Math.min(Math.max(cfgScale, 1), 20);
    } else {
      // Titan/Nova models max at 10
      cfgScale = Math.min(Math.max(cfgScale, 1), 10);
    }

    console.log(`CFG Scale adjusted for ${isStabilityModel ? 'Stability' : 'Titan/Nova'} model: ${otherParams.cfgScale} -> ${cfgScale}`);

    // Prepare the request payload based on the model
    let payload: ModelPayload;
    
    if (model.startsWith('stability.') || model.startsWith('stable') || model === 'sd3-large' || model === 'sd3.5-large') {
      // Stability AI models
      const stabilityPayload: StabilityPayload = {
        text_prompts: [
          {
            text: positivePrompt,
            weight: 1
          }
        ],
        cfg_scale: cfgScale,
        steps: otherParams.steps || 30,
        seed: otherParams.seed || Math.floor(Math.random() * 1000000),
        width: otherParams.width || 1024,
        height: otherParams.height || 1024,
      };

      if (negativePrompt && negativePrompt.trim()) {
        stabilityPayload.text_prompts.push({
          text: negativePrompt,
          weight: -1
        });
      }

      // Add image input for image-to-image generation
      if (inputImage) {
        stabilityPayload.init_image = inputImage;
        // Convert imageStrength (0.1-1.0) to image_strength (0.0-1.0)
        // Higher imageStrength means less change, so we invert it
        stabilityPayload.image_strength = 1.0 - (imageStrength || 0.7);
      }
      
      payload = stabilityPayload;
    } else if (model.startsWith('amazon.titan')) {
      // Amazon Titan models
      const imageConfig: ImageGenerationConfig = {
        numberOfImages: 1,
        height: otherParams.height || 1024,
        width: otherParams.width || 1024,
        cfgScale: cfgScale, // Use validated CFG scale
      };

      // Only add seed if it's provided and not null
      if (otherParams.seed !== null && otherParams.seed !== undefined) {
        imageConfig.seed = otherParams.seed;
      }

      if (inputImage) {
        // Titan supports image-to-image generation
        payload = {
          taskType: 'IMAGE_VARIATION',
          imageVariationParams: {
            text: positivePrompt,
            ...(negativePrompt && negativePrompt.trim() && { negativeText: negativePrompt }),
            images: [inputImage],
            similarityStrength: imageStrength || 0.7, // How similar to keep to the original (0.2-1.0)
          },
          imageGenerationConfig: imageConfig,
        };
      } else {
        // Text-to-image generation
        payload = {
          taskType: 'TEXT_IMAGE',
          textToImageParams: {
            text: positivePrompt,
            ...(negativePrompt && negativePrompt.trim() && { negativeText: negativePrompt }),
          },
          imageGenerationConfig: imageConfig,
        };
      }
    } else if (model.startsWith('amazon.nova')) {
      // Amazon Nova Canvas
      const imageConfig: ImageGenerationConfig = {
        numberOfImages: 1,
        height: otherParams.height || 1024,
        width: otherParams.width || 1024,
        cfgScale: cfgScale, // Use validated CFG scale
      };

      // Only add seed if it's provided and not null
      if (otherParams.seed !== null && otherParams.seed !== undefined) {
        imageConfig.seed = otherParams.seed;
      }

      if (inputImage) {
        // Nova Canvas supports image-to-image generation
        payload = {
          taskType: 'IMAGE_VARIATION',
          imageVariationParams: {
            text: positivePrompt,
            ...(negativePrompt && negativePrompt.trim() && { negativeText: negativePrompt }),
            images: [inputImage],
            similarityStrength: imageStrength || 0.7, // How similar to keep to the original
          },
          imageGenerationConfig: imageConfig,
        };
      } else {
        // Text-to-image generation
        payload = {
          taskType: 'TEXT_IMAGE',
          textToImageParams: {
            text: positivePrompt,
            ...(negativePrompt && negativePrompt.trim() && { negativeText: negativePrompt }),
          },
          imageGenerationConfig: imageConfig,
        };
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported model type' },
        { status: 400 }
      );
    }

    console.log('Payload prepared:', JSON.stringify(payload, null, 2));
    console.log('Using model ID:', modelId);

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract image data based on model response format
    let imageBase64;
    if (model.startsWith('stability.') || model.startsWith('stable') || model === 'sd3-large' || model === 'sd3.5-large') {
      imageBase64 = responseBody.artifacts?.[0]?.base64;
    } else if (model.startsWith('amazon.titan') || model.startsWith('amazon.nova')) {
      imageBase64 = responseBody.images?.[0];
    }

    if (!imageBase64) {
      throw new Error('No image data received from model');
    }

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${imageBase64}`,
    });

  } catch (error) {
    console.error('Error generating image:', error);
    
    // Provide more specific error messages and suggestions based on error type
    let errorMessage = 'Failed to generate image';
    let suggestion = '';
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('validation')) {
        if (errorMsg.includes('cfgscale') || errorMsg.includes('cfg_scale')) {
          errorMessage = 'CFG Scale value is invalid';
          suggestion = `CFG Scale must be between 1-${isStabilityModel ? '20' : '10'} for this model. Current value may be too high`;
        } else if (errorMsg.includes('width') || errorMsg.includes('height')) {
          errorMessage = 'Image dimensions are invalid';
          suggestion = 'Please check that width and height are supported values (typically 512, 768, 1024, or 1536)';
        } else if (errorMsg.includes('steps')) {
          errorMessage = 'Steps value is invalid';
          suggestion = 'Steps must be between 10-50 for Stability models';
        } else {
          errorMessage = 'Invalid parameters provided';
          suggestion = 'Please check your parameter values (CFG scale, dimensions, etc.) and try again';
        }
      } else if (errorMsg.includes('access denied') || errorMsg.includes('unauthorized')) {
        errorMessage = 'Access denied to AI model';
        suggestion = 'Please check your AWS Bedrock model access permissions in the AWS console';
      } else if (errorMsg.includes('throttling') || errorMsg.includes('rate limit')) {
        errorMessage = 'Request rate limit exceeded';
        suggestion = 'Please wait a moment and try again';
      } else if (errorMsg.includes('quota') || errorMsg.includes('limit exceeded')) {
        errorMessage = 'Service quota exceeded';
        suggestion = 'You may have reached your AWS Bedrock usage limits. Check your AWS console for quota information';
      } else if (errorMsg.includes('model') && errorMsg.includes('not found')) {
        errorMessage = 'AI model not available';
        suggestion = 'The selected model may not be available in your region. Try refreshing the model list or selecting a different model';
      } else if (errorMsg.includes('on-demand throughput')) {
        errorMessage = 'Model requires provisioned throughput';
        suggestion = 'This model is not available for on-demand use. Please select a different model or configure provisioned throughput in AWS Bedrock';
      } else if (errorMsg.includes('credentials') || errorMsg.includes('signature')) {
        errorMessage = 'AWS authentication failed';
        suggestion = 'Please check your AWS credentials configuration';
      } else {
        errorMessage = 'Image generation failed';
        suggestion = 'Please try again with different parameters or contact support if the issue persists';
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion: suggestion
      },
      { status: 500 }
    );
  }
}

# AI Image Generator

A Next.js application that uses AWS Bedrock to generate images with various AI models including Stable Diffusion, Titan, and Nova Canvas.

## Features

- **Dynamic Model Loading**: Automatically detects and loads available AI models from your AWS Bedrock account
- **Multiple AI Models**: Support for various image generation models including:
  - Amazon Nova Canvas
  - Amazon Titan Image Generator G1 & G1 v2
  - Stability AI models (SD3, Stable Diffusion, Stable Image Ultra/Core)
  - And more based on your AWS Bedrock access

- **Comprehensive Controls**: 
  - Positive and negative prompts with helpful examples
  - CFG Scale adjustment
  - Steps control (for Stability models)
  - Width and height selection
  - Seed control for reproducible results

- **Smart User Experience**: 
  - Pre-populated with sensible defaults
  - Example prompt buttons for inspiration
  - Loading states while fetching available models
  - Fallback models if API fails
  - Refresh models button to reload available options

- **Modern UI**: Built with Amplify UI React components for a clean, responsive interface

## Setup

### Prerequisites

- Node.js 18+ 
- AWS Account with Bedrock access
- AWS credentials configured

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

3. Edit `.env.local` with your AWS credentials:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

### AWS Bedrock Setup

1. **Enable Model Access**: Go to AWS Bedrock console and request access to the models you want to use:
   - Stability AI models (SD3, Stable Diffusion, etc.)
   - Amazon Titan Image Generator
   - Amazon Nova Canvas

2. **Local Development - IAM Permissions**: Ensure your AWS credentials have the following permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:ListFoundationModels"
            ],
            "Resource": [
                "arn:aws:bedrock:*::foundation-model/*"
            ]
        }
    ]
}
```

3. **Deployment - IAM Role**: For deployed environments, attach the above permissions to your compute role (Lambda execution role, ECS task role, etc.). The app automatically detects and uses IAM roles when environment variables are not present.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. Select an AI model from the dropdown
2. Enter a positive prompt describing what you want to generate
3. Optionally add a negative prompt for what to avoid
4. Adjust parameters like CFG scale, dimensions, and seed
5. Click "Generate Image" and wait for the result

## API Routes

### POST /api/generate-image

Generates an image using the specified Bedrock model.

**Request Body:**
```json
{
  "model": "nova-canvas",
  "positivePrompt": "A beautiful sunset over mountains",
  "negativePrompt": "blurry, low quality",
  "cfgScale": 7,
  "steps": 30,
  "width": 1024,
  "height": 1024,
  "seed": 12345
}
```

**Response:**
```json
{
  "success": true,
  "image": "data:image/png;base64,..."
}
```

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: AWS Amplify UI React
- **Backend**: Next.js API Routes
- **AI Models**: AWS Bedrock
- **AWS SDK**: @aws-sdk/client-bedrock-runtime

## Model-Specific Notes

- **Stability Models**: Support steps parameter for fine-tuning generation quality
- **Titan Models**: Optimized for general-purpose image generation
- **Nova Canvas**: Amazon's latest model with advanced capabilities

## Troubleshooting

### Common Issues

1. **Model Access Denied**: Ensure you've requested access to the specific models in AWS Bedrock console
2. **AWS Credentials**: Verify your AWS credentials are correctly configured
3. **Region Availability**: Some models may not be available in all regions
4. **Invalid Model Identifier**: Some model IDs may vary by region or availability

### Error Messages

- `Model and positive prompt are required`: Fill in both required fields
- `Invalid model selected`: Check if the model ID is correct
- `The provided model identifier is invalid`: The model may not be available in your region or you may not have access
- `Failed to generate image`: Check AWS credentials and model access

### Debugging Model Issues

1. Click the "Debug Models" button in the app to see which models are available in your region
2. Check the browser console for detailed error messages and available model IDs
3. Visit the AWS Bedrock console to verify which models you have access to
4. Some models like "Titan Image Generator G1 v2" may not be available and will fall back to v1

### Model Availability Notes

- **Stability Models**: Require explicit access request in AWS Bedrock console
- **Titan Models**: Generally available but v2 may not be available in all regions
- **Nova Canvas**: Amazon's latest model, may require special access
- **Regional Differences**: Model availability varies by AWS region

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

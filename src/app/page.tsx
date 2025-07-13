'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Button,
  Card,
  Flex,
  Heading,
  SelectField,
  TextField,
  Text,
  Loader,
  Alert,
  SliderField,
  View,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

const EXAMPLE_PROMPTS = [
  "A majestic mountain landscape at golden hour, highly detailed, photorealistic",
  "A futuristic cityscape with flying cars and neon lights, cyberpunk style",
  "A cute cartoon cat wearing a wizard hat, digital art, colorful",
  "An abstract painting with vibrant colors and geometric shapes",
  "A serene Japanese garden with cherry blossoms and a koi pond",
];

const IMAGE_TO_IMAGE_PROMPTS = [
  "Transform this into a watercolor painting style",
  "Make this look like a vintage photograph from the 1950s",
  "Convert to anime/manga art style with vibrant colors",
  "Turn this into a cyberpunk scene with neon lights",
  "Make it look like an oil painting by Van Gogh",
  "Transform into a fantasy landscape with magical elements",
];

// localStorage key for form data
const FORM_STORAGE_KEY = 'ai-image-generator-form-v1';

interface BedrockModel {
  modelId: string;
  modelName?: string;
  providerName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
}

interface ModelOption {
  value: string;
  label: string;
}

interface FormData {
  model: string;
  positivePrompt: string;
  negativePrompt: string;
  cfgScale: number;
  steps: number;
  width: number;
  height: number;
  seed: number | null;
  inputImage: string | null; // Base64 encoded image
  imageStrength: number; // How much to transform the input image (0.0-1.0)
}

export default function Home() {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [modelsData, setModelsData] = useState<BedrockModel[]>([]); // Store full model data
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null); // Track model loading errors

  // Initialize form data with localStorage values or defaults
  const getInitialFormData = (): FormData => {
    if (typeof window === 'undefined') {
      // Server-side rendering - return defaults
      return {
        model: 'amazon.nova-canvas-v1:0',
        positivePrompt: 'A beautiful landscape with mountains and a lake at sunset, highly detailed, photorealistic',
        negativePrompt: 'blurry, low quality, distorted, ugly',
        cfgScale: 7, // Safe default for all models
        steps: 30,
        width: 1024,
        height: 1024,
        seed: null,
        inputImage: null,
        imageStrength: 0.7,
      };
    }

    // Client-side - load from localStorage
    try {
      const saved = localStorage.getItem(FORM_STORAGE_KEY);
      if (saved) {
        const parsedData = JSON.parse(saved);
        // Ensure CFG scale is within safe limits for the selected model
        let cfgScale = parsedData.cfgScale || 7;
        const isStabilityModel = parsedData.model?.startsWith('stability.') ||
                                parsedData.model?.startsWith('stable') ||
                                parsedData.model === 'sd3-large' ||
                                parsedData.model === 'sd3.5-large';

        // Clamp CFG scale to model limits
        if (!isStabilityModel && cfgScale > 10) {
          cfgScale = 10;
        } else if (cfgScale > 20) {
          cfgScale = 20;
        }

        return {
          model: parsedData.model || 'amazon.nova-canvas-v1:0',
          positivePrompt: parsedData.positivePrompt || 'A beautiful landscape with mountains and a lake at sunset, highly detailed, photorealistic',
          negativePrompt: parsedData.negativePrompt || 'blurry, low quality, distorted, ugly',
          cfgScale: cfgScale,
          steps: parsedData.steps || 30,
          width: parsedData.width || 1024,
          height: parsedData.height || 1024,
          seed: parsedData.seed || null,
          inputImage: null, // Don't persist images for privacy/storage reasons
          imageStrength: parsedData.imageStrength || 0.7,
        };
      }
    } catch (error) {
      console.warn('Failed to load form data from localStorage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem(FORM_STORAGE_KEY);
      } catch (clearError) {
        console.warn('Failed to clear corrupted localStorage data:', clearError);
      }
    }

    // Fallback to defaults
    return {
      model: 'amazon.nova-canvas-v1:0',
      positivePrompt: 'A beautiful landscape with mountains and a lake at sunset, highly detailed, photorealistic',
      negativePrompt: 'blurry, low quality, distorted, ugly',
      cfgScale: 7, // Safe default for all models
      steps: 30,
      width: 1024,
      height: 1024,
      seed: null,
      inputImage: null,
      imageStrength: 0.7,
    };
  };

  const [formData, setFormData] = useState<FormData>(getInitialFormData);
  const [isHydrated, setIsHydrated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Function to create labels from model IDs
  const createModelLabel = (modelId: string): string => {
    // Always use the model ID directly
    return modelId;
  };

  // Function to create internal value from model ID
  const createModelValue = (modelId: string): string => {
    // For dynamic loading, we'll use the actual model ID as the value
    // This eliminates the need for complex mappings
    return modelId;
  };

  // Load available models from API
  const loadAvailableModels = useCallback(async () => {
    try {
      setIsLoadingModels(true);
      setModelLoadError(null); // Clear previous errors

      const response = await fetch('/api/list-models');
      const result = await response.json();

      if (result.success && result.models && result.models.length > 0) {
        // Store full model data for checking input modalities
        setModelsData(result.models);

        const dynamicOptions: ModelOption[] = result.models.map((model: BedrockModel) => ({
          value: createModelValue(model.modelId),
          label: createModelLabel(model.modelId),
        }));

        setModelOptions(dynamicOptions);

        // Set default model to first available model
        if (dynamicOptions.length > 0) {
          setFormData(prev => ({
            ...prev,
            model: dynamicOptions.find(option => option.value === prev.model)?.value || dynamicOptions[0].value
          }));
        }

        console.log('Loaded models:', dynamicOptions);
        console.log(`Found ${result.filteredModels} on-demand compatible models out of ${result.totalModels} total models`);
      } else {
        // Handle API error response - this is now terminal
        const errorMessage = result.error || 'Unknown error occurred';
        const errorDetails = result.details || 'No additional details available';
        const suggestion = result.suggestion || 'Please check your configuration and try again.';

        setModelLoadError(`${errorMessage}: ${errorDetails}. ${suggestion}`);
        setModelOptions([]); // Clear any existing models
        console.error('Model loading failed:', result);
      }
    } catch (err) {
      // Network or parsing error - this is now terminal
      const errorMessage = err instanceof Error ? err.message : 'Network or parsing error';
      setModelLoadError(`Failed to connect to model API: ${errorMessage}. Please check your internet connection and try again.`);
      setModelOptions([]); // Clear any existing models
      console.error('Error loading models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Load models on component mount
  useEffect(() => {
    loadAvailableModels();
  }, [loadAvailableModels]);

  // Initialize form data from localStorage on client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initialData = getInitialFormData();
      setFormData(initialData);
      setIsHydrated(true);
    }
  }, []);

  // Save form data to localStorage whenever it changes (excluding inputImage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const dataToSave = {
          ...formData,
          inputImage: null, // Don't save images for privacy/storage reasons
        };
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (error) {
        console.warn('Failed to save form data to localStorage:', error);
        // Handle quota exceeded or other storage errors gracefully
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded. Consider clearing old data.');
        }
      }
    }
  }, [formData]);

  // Helper function to check if current model supports image input
  const currentModelSupportsImageInput = (): boolean => {
    const currentModel = modelsData.find(model => model.modelId === formData.model);
    return currentModel?.inputModalities?.includes('IMAGE') || false;
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setFormData(prev => ({ ...prev, inputImage: null }));
      return;
    }

    const file = files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file must be smaller than 5MB');
      return;
    }

    try {
      const base64Data = await fileToBase64(file);
      setFormData(prev => ({ ...prev, inputImage: base64Data }));
      setError(null);
    } catch (err) {
      setError('Failed to process image file');
      console.error('Image processing error:', err);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.positivePrompt.trim()) {
      setError('Positive prompt is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Extract detailed error information from API response
        const errorMessage = result.error || 'Failed to generate image';
        const errorDetails = result.details || '';
        const suggestion = result.suggestion || '';
        
        // Combine error information for better user feedback
        let fullErrorMessage = errorMessage;
        if (errorDetails) {
          fullErrorMessage += `: ${errorDetails}`;
        }
        if (suggestion) {
          fullErrorMessage += `. ${suggestion}`;
        }
        
        throw new Error(fullErrorMessage);
      }

      setGeneratedImage(result.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * 1000000);
    setFormData(prev => ({ ...prev, seed: randomSeed }));
  };

  const resetToDefaults = () => {
    const defaultData: FormData = {
      model: 'amazon.nova-canvas-v1:0',
      positivePrompt: 'A beautiful landscape with mountains and a lake at sunset, highly detailed, photorealistic',
      negativePrompt: 'blurry, low quality, distorted, ugly',
      cfgScale: 7,
      steps: 30,
      width: 1024,
      height: 1024,
      seed: null,
      inputImage: null,
      imageStrength: 0.7,
    };

    setFormData(defaultData);

    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(FORM_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
      }
    }
  };

  const checkAvailableModels = async () => {
    await loadAvailableModels();

    // Don't override the modelLoadError with a success message if there was an error
    if (!modelLoadError) {
      const response = await fetch('/api/list-models');
      const result = await response.json();

      if (result.success) {
        setError(`✅ Model refresh successful! Found ${result.filteredModels} on-demand compatible models out of ${result.totalModels} total models. ${result.filterReason || ''}`);
      }
    }
  };

  // Use safe defaults during SSR to prevent hydration mismatch
  const isStabilityModel = isHydrated ? (
    formData.model.includes('stabl') ||
    formData.model === 'sd3-large' ||
    formData.model === 'sd3.5-large'
  ) : false; // Default to false during SSR since default model is Nova Canvas

  // Determine CFG Scale limits based on model type
  const getCfgScaleLimits = () => {
    // During SSR, always return the safe default limits to prevent hydration mismatch
    if (!isHydrated) {
      return { min: 1, max: 10, step: 0.5 }; // Safe default for Nova Canvas
    }
    
    if (formData.model.startsWith('stability.') || isStabilityModel) {
      return { min: 1, max: 20, step: 0.5 }; // Stability models support higher CFG
    } else {
      return { min: 1, max: 10, step: 0.5 }; // Titan/Nova models max at 10
    }
  };

  const cfgLimits = getCfgScaleLimits();

  // Adjust CFG scale if it exceeds the current model's limit
  useEffect(() => {
    if (formData.cfgScale > cfgLimits.max) {
      setFormData(prev => ({ ...prev, cfgScale: cfgLimits.max }));
    }
  }, [formData.model, formData.cfgScale, cfgLimits.max]);

  return (
    <View padding="1rem">
      <Flex direction="column" alignItems="center" gap="2rem">

        {/* Model Loading Error Alert */}
        {modelLoadError && (
          <Alert variation="error" width="100%" maxWidth="800px">
            <Heading level={4}>Unable to Load AI Models</Heading>
            <Text>{modelLoadError}</Text>
            <Flex direction="row" gap="1rem" marginTop="1rem">
              <Button
                type="button"
                onClick={() => {
                  setModelLoadError(null);
                  loadAvailableModels();
                }}
                variation="primary"
                size="small"
              >
                Retry Loading Models
              </Button>
            </Flex>
          </Alert>
        )}

        {/* Main Form - Only show if models loaded successfully */}
        {!modelLoadError && (
          <Card width="100%" maxWidth="800px" padding="2rem">
            <form onSubmit={handleSubmit}>
              <Flex direction="column" gap="1.5rem">
                <Flex direction="row" justifyContent="space-between" alignItems="center">
                  <Text fontSize="0.75rem" color="gray.500">
                    💾 Settings are automatically saved
                  </Text>
                </Flex>
              <SelectField
                label="Model"
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                required
                isDisabled={isLoadingModels}
              >
                {isLoadingModels ? (
                  <option value="">Loading models...</option>
                ) : (
                  modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </SelectField>

              {isLoadingModels && (
                <Flex direction="row" alignItems="center" gap="0.5rem">
                  <Loader size="small" />
                  <Text fontSize="0.875rem" color="gray.600">
                    Loading available models from AWS Bedrock...
                  </Text>
                </Flex>
              )}

              {/* Image Upload Section - Only show for models that support IMAGE input */}
              {currentModelSupportsImageInput() && (
                <View>
                  <Text fontSize="1rem" fontWeight="bold" marginBottom="0.5rem">
                    Input Image (Optional)
                  </Text>
                  <Text fontSize="0.875rem" color="gray.600" marginBottom="1rem">
                    Upload an image to use as input for image-to-image generation. The model will use this as a starting point and modify it based on your prompt.
                  </Text>

                  <View
                    className="file-upload-area"
                    style={{
                      border: '2px dashed',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" style={{ cursor: 'pointer', display: 'block' }}>
                      <Text fontSize="1rem" marginBottom="0.5rem">
                        📁 Click to upload an image
                      </Text>
                      <Text fontSize="0.875rem" color="gray.600">
                        Supports JPG, PNG, GIF up to 5MB
                      </Text>
                    </label>

                    {formData.inputImage && (
                      <Button
                        type="button"
                        size="small"
                        variation="link"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, inputImage: null }));
                          // Reset the file input
                          const input = document.getElementById('image-upload') as HTMLInputElement;
                          if (input) input.value = '';
                        }}
                        style={{ marginTop: '0.5rem' }}
                      >
                        Remove Image
                      </Button>
                    )}
                  </View>

                  {formData.inputImage && (
                    <View marginTop="1rem">
                      <Text fontSize="0.875rem" color="green.600" marginBottom="0.5rem">
                        ✓ Image uploaded successfully
                      </Text>
                      <View
                        className="image-preview"
                        style={{
                          maxWidth: '200px',
                          overflow: 'hidden'
                        }}
                      >
                        <Image
                          src={`data:image/jpeg;base64,${formData.inputImage}`}
                          alt="Input image preview"
                          width={200}
                          height={200}
                          style={{
                            width: '100%',
                            height: 'auto',
                            objectFit: 'cover'
                          }}
                        />
                      </View>
                    </View>
                  )}

                  {/* Image Strength Control - Only show when input image is provided */}
                  {formData.inputImage && (
                    <View marginTop="1rem">
                      <SliderField
                        label={`Image Influence: ${formData.imageStrength} (${formData.imageStrength < 0.3 ? 'High Change' : formData.imageStrength < 0.7 ? 'Moderate Change' : 'Subtle Change'})`}
                        min={0.1}
                        max={1.0}
                        step={0.1}
                        value={formData.imageStrength}
                        onChange={(value) => handleInputChange('imageStrength', value)}
                      />
                      <Text fontSize="0.75rem" color="gray.500" marginTop="0.25rem">
                        How much to preserve from your original image. Low (0.1-0.3) = dramatic transformation, Medium (0.4-0.7) = balanced change, High (0.8-1.0) = subtle modifications.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TextField
                label="Positive Prompt"
                value={formData.positivePrompt}
                onChange={(e) => handleInputChange('positivePrompt', e.target.value)}
                placeholder="e.g., A majestic mountain landscape at golden hour, highly detailed, photorealistic"
                required
                as="textarea"
                rows={3}
              />

              <View>
                <Text fontSize="0.875rem" color="gray.600" marginBottom="0.5rem">
                  {formData.inputImage ? 'Try these image transformation examples:' : 'Try these examples:'}
                </Text>
                <Flex direction="row" gap="0.5rem" wrap="wrap">
                  {(formData.inputImage ? IMAGE_TO_IMAGE_PROMPTS : EXAMPLE_PROMPTS).map((prompt, index) => (
                    <Button
                      key={index}
                      type="button"
                      size="small"
                      variation="link"
                      onClick={() => handleInputChange('positivePrompt', prompt)}
                    >
                      Example {index + 1}
                    </Button>
                  ))}
                </Flex>
              </View>

              <Flex direction="row" gap="1rem" alignItems="end">
                <View flex="1">
                  <TextField
                    label="Negative Prompt (Optional)"
                    value={formData.negativePrompt}
                    onChange={(e) => handleInputChange('negativePrompt', e.target.value)}
                    placeholder="e.g., blurry, low quality, distorted, ugly, watermark"
                    as="textarea"
                    rows={2}
                  />
                </View>
                <Button
                  type="button"
                  onClick={() => handleInputChange('negativePrompt', '')}
                  variation="link"
                  size="small"
                >
                  Clear
                </Button>
              </Flex>

              <Flex direction="row" gap="1rem" wrap="wrap">
                <View flex="1" minWidth="200px">
                  <SliderField
                    label={`CFG Scale: ${formData.cfgScale} (${isStabilityModel ? 'Stability' : 'Titan/Nova'} range: ${cfgLimits.min}-${cfgLimits.max})`}
                    min={cfgLimits.min}
                    max={cfgLimits.max}
                    step={cfgLimits.step}
                    value={formData.cfgScale}
                    onChange={(value) => handleInputChange('cfgScale', value)}
                  />
                  <Text fontSize="0.75rem" color="gray.500" marginTop="0.25rem">
                    Controls how closely the AI follows your prompt. Higher values = stricter adherence but less creativity.
                    {isStabilityModel
                      ? ' Stability models: Sweet spot 6-8, can go up to 20 for very strict control.'
                      : ' Titan/Nova models: Sweet spot 6-8, maximum 10.'
                    }
                  </Text>
                </View>

                {isStabilityModel && (
                  <View flex="1" minWidth="200px">
                    <SliderField
                      label={`Steps: ${formData.steps}`}
                      min={10}
                      max={50}
                      step={1}
                      value={formData.steps}
                      onChange={(value) => handleInputChange('steps', value)}
                    />
                    <Text fontSize="0.75rem" color="gray.500" marginTop="0.25rem">
                      Number of denoising steps. More steps (30-50) = higher quality but slower generation. Fewer steps (10-20) = faster but potentially lower quality. Recommended: 20-30.
                    </Text>
                  </View>
                )}
              </Flex>

              <View>
                <Text fontSize="0.875rem" color="gray.600" marginBottom="0.5rem">
                  Image Dimensions (larger sizes take more time to generate)
                </Text>
                <Flex direction="row" gap="1rem" wrap="wrap">
                  <View flex="1" minWidth="150px">
                    <SelectField
                      label="Width"
                      value={formData.width.toString()}
                      onChange={(e) => handleInputChange('width', parseInt(e.target.value))}
                    >
                      <option value="512">512px</option>
                      <option value="768">768px</option>
                      <option value="1024">1024px</option>
                      <option value="1536">1536px</option>
                    </SelectField>
                  </View>

                  <View flex="1" minWidth="150px">
                    <SelectField
                      label="Height"
                      value={formData.height.toString()}
                      onChange={(e) => handleInputChange('height', parseInt(e.target.value))}
                    >
                      <option value="512">512px</option>
                      <option value="768">768px</option>
                      <option value="1024">1024px</option>
                      <option value="1536">1536px</option>
                    </SelectField>
                  </View>
                </Flex>
              </View>

              <Flex direction="row" gap="1rem" alignItems="end">
                <View flex="1">
                  <TextField
                    label="Seed (Optional)"
                    type="number"
                    value={formData.seed?.toString() || ''}
                    onChange={(e) => handleInputChange('seed', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Leave empty for random"
                  />
                  <Text fontSize="0.75rem" color="gray.500" marginTop="0.25rem">
                    Controls randomness. Same seed + same prompt = identical image. Use for consistent results or leave empty for variety.
                  </Text>
                </View>
                <Button
                  type="button"
                  onClick={generateRandomSeed}
                  variation="link"
                >
                  Random
                </Button>
              </Flex>

              <Flex direction="row" gap="1rem" alignItems="center">
                <Button
                  type="submit"
                  variation="primary"
                  isLoading={isLoading}
                  loadingText="Generating..."
                  isDisabled={isLoading}
                  size="large"
                  flex="1"
                >
                  Generate Image
                </Button>

                <Button
                  type="button"
                  onClick={checkAvailableModels}
                  variation="link"
                  size="small"
                >
                  Refresh Models
                </Button>

                <Button
                  type="button"
                  onClick={resetToDefaults}
                  variation="link"
                  size="small"
                  title="Reset all settings to default values"
                >
                  Reset Defaults
                </Button>
              </Flex>
            </Flex>
          </form>
        </Card>
        )}

        {error && (
          <Alert variation="error" isDismissible onDismiss={() => setError(null)} width="100%" maxWidth="800px">
            <Heading level={4}>Image Generation Failed</Heading>
            <Text>{error}</Text>
          </Alert>
        )}

        {isLoading && (
          <Card width="100%" maxWidth="800px" padding="2rem">
            <Flex direction="column" alignItems="center" gap="1rem">
              <Loader size="large" />
              <Text>Generating your image... This may take a few moments.</Text>
            </Flex>
          </Card>
        )}

        {generatedImage && (
          <Card width="100%" maxWidth="800px" padding="2rem">
            <Flex direction="column" alignItems="center" gap="1rem">
              <Heading level={3}>Generated Image</Heading>
              <Image
                src={generatedImage}
                alt="Generated image"
                width={1024}
                height={1024}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              />
            </Flex>
          </Card>
        )}
      </Flex>
    </View>
  );
}

import { useMutation } from '@tanstack/react-query';

// Base API configuration with single source of truth
const API = {
  predict: {
    url: "https://4mf6hjno08.execute-api.eu-west-1.amazonaws.com/predict_pine",
    requestExample: { 
      user: String(), 
      image_s3_uri: String(),
      model_s3_uri: String(), 
    },
    responseExample: { 
      user: String(), 
      image_s3_uri: String(), 
      predictions: [] as readonly any[] // Changed from prediction to predictions
    }
  },
  output_image: {
    url: "https://4mf6hjno08.execute-api.eu-west-1.amazonaws.com/output-image-creator",
    requestExample: { 
      user: String(), 
      image_s3_uri: String(),
      predictions: [] as readonly any[]
    },
    responseExample: {
      user: String(), 
      image_s3_uri: String(),
      predictions: [] as readonly any[], 
      annotated_s3_uri: String() 
    }
  },
  reference_calculator: {
    url: "https://4mf6hjno08.execute-api.eu-west-1.amazonaws.com/reference_calculator",
    requestExample: { 
      predictions: [] as readonly any[],
      reference_width_cm: Number(), // 10
      reference_width_px: Number(), // 
      focal_length_px: Number(), // 400
    },
    responseExample: [{
      "class": String(),
      "confidence": Number(),
      "width_cm": Number(),
      "height_cm": Number(),
      "length_cm": Number(),
      "volume_cm3": Number(),
      "bbox": [] as Number[],
    }]
  },
  dynmo_create: {
    url: "https://4mf6hjno08.execute-api.eu-west-1.amazonaws.com/predictions",
    requestExample: { 
      user: String(), 
      image_s3_uri: String(), 
      predictions: [] as readonly any[],
      annotated_s3_uri: String() 
    },
    responseExample: { 
      message: String(),
      prediction_id: String(), 
    }
  }
} as const;

// Infer types from example objects
type EndpointKeys = keyof typeof API;
type RequestType<T extends EndpointKeys> = typeof API[T]['requestExample'];
type ResponseType<T extends EndpointKeys> = typeof API[T]['responseExample'];

// Base fetcher function
const fetchApi = async <T extends EndpointKeys>(
  endpoint: T, 
  data: RequestType<T>
): Promise<ResponseType<T>> => {
  console.log('API request:', endpoint, data);
  const response = await fetch(API[endpoint].url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${JSON.stringify(await response.json())}`);
  }
  
  return response.json();
};

// Generic mutation hook factory
function createMutationHook<T extends EndpointKeys>(endpoint: T) {
  return () => useMutation({
    mutationFn: (data: RequestType<T>) => fetchApi(endpoint, data)
  });
}

// Create a mapped type for all hooks
type ApiHooks = {
  [K in EndpointKeys as `use${Capitalize<string & K>}Mutation`]: () => ReturnType<typeof useMutation<
    ResponseType<K>, 
    Error, 
    RequestType<K>
  >>
};

// Auto-generate all mutation hooks directly from the API dictionary
const apiHooks = Object.keys(API).reduce<Record<string, any>>((hooks, key) => {
  const endpoint = key as EndpointKeys;
  const hookName = `use${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)}Mutation`;
  return {
    ...hooks,
    [hookName]: createMutationHook(endpoint)
  };
}, {});

export const hooks: ApiHooks = apiHooks as ApiHooks;

// Generic hook for flexible usage
export function useApiMutation<T extends EndpointKeys>(endpoint: T) {
  return useMutation({
    mutationFn: (data: RequestType<T>) => fetchApi(endpoint, data)
  });
}

export { API, fetchApi };
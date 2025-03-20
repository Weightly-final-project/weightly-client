import { useMutation } from '@tanstack/react-query';

// Base API configuration with single source of truth
const API = {
  predict: {
    url: "https://kg6d74p2xcfjejhqfucddvfjye0ktpzr.lambda-url.eu-west-1.on.aws/",
    requestExample: { 
      user: String(), 
      image_s3_uri: String() 
    },
    responseExample: { 
      user: String(), 
      image_s3_uri: String(), 
      predictions: [] as any[] // Changed from prediction to predictions
    }
  },
  output_image: {
    url: "https://wexmozjmbvb2knoqpkltzazu3y0nlixp.lambda-url.eu-west-1.on.aws/",
    requestExample: { 
      user: String(), 
      image_s3_uri: String(),
      predictions: [] as any[]
    },
    responseExample: {
      user: String(), 
      image_s3_uri: String(),
      predictions: [] as any[], 
      annotated_s3_uri: String() 
    }
  },
  dynmo_create: {
    url: "https://s6oeijufprvfccw3duv7xunfv40iydre.lambda-url.eu-west-1.on.aws/",
    requestExample: { 
      user: String(), 
      image_s3_uri: String(), 
      predictions: [] as any[],
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
  const response = await fetch(API[endpoint].url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
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
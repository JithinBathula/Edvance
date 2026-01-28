// Defines the base URL for the Flask backend API
// Uses VITE_API_URL environment variable with fallback to localhost for development
const BASE_URL = import.meta.env.VITE_API_URL;
export const BACKEND_URL = `${BASE_URL}/api`;
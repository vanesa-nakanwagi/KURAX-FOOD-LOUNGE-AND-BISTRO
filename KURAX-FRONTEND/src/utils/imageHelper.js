// src/utils/imageHelper.js

export const getImageSrc = (url) => {
  if (!url) return "/placeholder.png";
  if (url.startsWith("http")) return url;

  // 1. Try to get the API URL from environment variables (Standard Vite/React practice)
  // 2. Fallback to your local URL if the variable isn't set
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5010";
  
  // Ensure we don't end up with double slashes (e.g., http://url.com//uploads)
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  
  return `${API_BASE_URL}${cleanUrl}`;
};
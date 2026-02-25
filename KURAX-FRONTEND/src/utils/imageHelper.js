// src/utils/imageHelper.js
export const getImageSrc = (url) => {
  if (!url) return "/placeholder.png";
  if (url.startsWith("http")) return url;
  return `http://localhost:5000${url}`;
};
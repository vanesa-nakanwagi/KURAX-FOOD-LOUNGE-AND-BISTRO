import fs from 'node:fs/promises';

function getStorageConfig(env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url && !serviceRoleKey) return null;
  if (!url || !serviceRoleKey) {
    const error = new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be configured for menu image storage.');
    error.code = 'MENU_IMAGE_STORAGE_CONFIG_INCOMPLETE';
    throw error;
  }
  return {
    url,
    serviceRoleKey,
    bucket: String(env.MENU_IMAGE_BUCKET || 'menu-images').trim(),
  };
}

function encodeObjectPath(objectPath) {
  return objectPath.split('/').map(encodeURIComponent).join('/');
}

export async function uploadMenuImage(file, { env = process.env, fetchImpl = fetch } = {}) {
  const config = getStorageConfig(env);
  if (!config) {
    return { imageUrl: `/uploads/${file.filename}`, storedRemotely: false };
  }

  const objectPath = `menu/${file.filename}`;
  const response = await fetchImpl(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`,
    {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': file.mimetype,
      },
      body: file.buffer ?? await fs.readFile(file.path),
    }
  );
  if (!response.ok) {
    const error = new Error(`Supabase menu image upload failed with status ${response.status}.`);
    error.code = 'MENU_IMAGE_UPLOAD_FAILED';
    throw error;
  }

  if (file.path) {
    try {
      await fs.unlink(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Menu image temporary-file cleanup failed:', error.message);
      }
    }
  }

  return {
    imageUrl: `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`,
    storedRemotely: true,
  };
}

export async function removeStoredMenuImage(imageUrl, { env = process.env, fetchImpl = fetch } = {}) {
  const config = getStorageConfig(env);
  if (!config || !imageUrl) return false;

  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    return false;
  }
  const storageOrigin = new URL(config.url).origin;
  const publicPrefix = `/storage/v1/object/public/${encodeURIComponent(config.bucket)}/`;
  if (url.origin !== storageOrigin || !url.pathname.startsWith(publicPrefix)) return false;

  let objectPath;
  try {
    objectPath = url.pathname.slice(publicPrefix.length).split('/').map(decodeURIComponent).join('/');
  } catch {
    return false;
  }
  if (!objectPath.startsWith('menu/') || objectPath.length === 'menu/'.length) return false;

  const response = await fetchImpl(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [objectPath] }),
    }
  );
  if (!response.ok) {
    const error = new Error(`Supabase menu image deletion failed with status ${response.status}.`);
    error.code = 'MENU_IMAGE_DELETE_FAILED';
    throw error;
  }
  return true;
}

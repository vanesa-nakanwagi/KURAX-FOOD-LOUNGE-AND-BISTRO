import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadMenuImage, removeStoredMenuImage } from '../helpers/menuImageStorage.js';

const env = {
  SUPABASE_URL: 'https://storage.example.test/',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  MENU_IMAGE_BUCKET: 'menu-images',
};

test('menu image uploads stay local when Supabase Storage is not configured', async () => {
  const result = await uploadMenuImage({ filename: 'menu.jpg' }, { env: {} });

  assert.deepEqual(result, { imageUrl: '/uploads/menu.jpg', storedRemotely: false });
});

test('menu image uploads use the configured public Supabase Storage URL', async () => {
  let request;
  const result = await uploadMenuImage({
    filename: 'menu item.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('image bytes'),
  }, {
    env,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  });

  assert.equal(result.imageUrl, 'https://storage.example.test/storage/v1/object/public/menu-images/menu/menu%20item.jpg');
  assert.equal(result.storedRemotely, true);
  assert.equal(request.url, 'https://storage.example.test/storage/v1/object/menu-images/menu/menu%20item.jpg');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer test-service-role-key');
  assert.equal(request.options.headers['Content-Type'], 'image/jpeg');
});

test('menu image uploads fail explicitly when Storage rejects the request', async () => {
  await assert.rejects(
    uploadMenuImage({
      filename: 'menu.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('image bytes'),
    }, {
      env,
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }),
    { code: 'MENU_IMAGE_UPLOAD_FAILED' }
  );
});

test('menu image removal only deletes paths in the configured menu bucket', async () => {
  let request;
  const deleted = await removeStoredMenuImage(
    'https://storage.example.test/storage/v1/object/public/menu-images/menu/menu%20item.jpg',
    {
      env,
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, status: 200 };
      },
    }
  );
  const ignored = await removeStoredMenuImage(
    'https://other.example.test/storage/v1/object/public/menu-images/menu/menu.jpg',
    { env, fetchImpl: async () => { throw new Error('Unexpected request'); } }
  );

  assert.equal(deleted, true);
  assert.equal(ignored, false);
  assert.equal(request.url, 'https://storage.example.test/storage/v1/object/menu-images');
  assert.deepEqual(JSON.parse(request.options.body), { prefixes: ['menu/menu item.jpg'] });
});

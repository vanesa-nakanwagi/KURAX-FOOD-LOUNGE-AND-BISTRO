
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function firebaseWorkerConfigPlugin(firebaseConfig) {
	const source = `self.KURAX_FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig)};`;
	return {
		name: 'kurax-firebase-worker-config',
		configureServer(server) {
			server.middlewares.use('/firebase-config.js', (_request, response) => {
				response.setHeader('Content-Type', 'application/javascript');
				response.setHeader('Cache-Control', 'no-store');
				response.end(source);
			});
		},
		generateBundle() {
			this.emitFile({ type: 'asset', fileName: 'firebase-config.js', source });
		},
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const firebaseConfig = {
		apiKey: env.VITE_FIREBASE_API_KEY || '',
		authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
		projectId: env.VITE_FIREBASE_PROJECT_ID || '',
		storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
		messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
		appId: env.VITE_FIREBASE_APP_ID || '',
	};
	return { plugins: [react(), firebaseWorkerConfigPlugin(firebaseConfig)] };
});

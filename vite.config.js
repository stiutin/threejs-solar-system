import {defineConfig} from 'vite';

export default defineConfig({
  // Relative base: the build works on any sub-path, e.g. https://stiutin.github.io/<repository>/
  base: './',
  preview: {
    port: 4174,
    strictPort: true,
  },
});

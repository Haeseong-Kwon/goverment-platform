import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// tsconfig의 "@/*" 경로 별칭을 테스트 런타임에도 동일하게 적용합니다.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});

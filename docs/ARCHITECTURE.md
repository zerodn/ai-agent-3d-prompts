# Kiến trúc source (monorepo)

Source được tách thành các package độc lập để có thể đưa sang project khác (ví dụ Landium) mà không phải mang theo app demo.

```
packages/
  core/    @agent-world/core   TS thuần: domain, state machine, engine mô phỏng, contract backend
  react/   @agent-world/react  React 19: store, UI, thế giới 3D (R3F). Từ giai đoạn 2 trở đi
apps/
  web/     @agent-world/web    App demo Next.js 16, chỉ ghép các package lại
prompts/   Prompt gốc (8 giai đoạn)
```

## Quy tắc phụ thuộc

- `core` **không** import React, three, Next hay alias `@/`. ESLint chặn việc này (`no-restricted-imports`). Import nội bộ dùng đuôi `.ts` để Node chạy test trực tiếp (`node --experimental-strip-types`).
- `react` chỉ phụ thuộc `core` và thư viện render. Không đọc biến môi trường.
- `apps/web` là nơi duy nhất biết đến Next.js và `NEXT_PUBLIC_*` (xem `apps/web/src/lib/backend.ts`).

## Điểm mở rộng cho project khác

| Nhu cầu | Cách làm |
| --- | --- |
| Đổi nhịp độ, giới hạn | `new SimulationEngine({ config: { maxConcurrentTasks: 3, durations: { research: 8 } } })` |
| Nội dung theo domain riêng | `new SimulationEngine({ workTemplates: [...] })` với kiểu `WorkTemplate` |
| Nối backend thật | Implement `AgentBackend` (`packages/core/src/integrations/AgentBackend.ts`) hoặc dựng server nói đúng giao thức trong `protocol.ts` rồi dùng `WebSocketAgentBackend` |
| Chọn backend theo env của host | `createBackend({ kind, url })`; host tự ánh xạ biến môi trường (`VITE_*`, `NEXT_PUBLIC_*`, ...) |

## Dùng trong project khác

Hiện các package xuất trực tiếp mã nguồn TypeScript (`exports: "./src/index.ts"`). Host cần bundler biên dịch được TS trong `node_modules`:

- Next.js: `transpilePackages: ["three", "@agent-world/core", "@agent-world/react"]`.
- Vite: dùng được trực tiếp.

Nhúng toàn bộ trải nghiệm vào một trang React 19 (component client):

```tsx
import { createBackend } from "@agent-world/core";
import { AppShell } from "@agent-world/react";

const backend = createBackend({ kind: "mock" }); // hoặc { kind: "websocket", url }
<AppShell backend={backend} autoStart quality="high" />;
```

CSS của host (Tailwind 4):

```css
@import "tailwindcss";
@import "@agent-world/react/styles.css";
```

`AppShell` chiếm toàn viewport (`position: fixed`). Host muốn tự dựng UI thì dùng các khối lẻ được export (`WorldCanvas`, `AgentLabelsOverlay`, `SidePanel`, `useWorldStore`, `commands`, ...).

Thư mục `packages/react/src/world/` tắt luật `react-hooks/immutability`: object three.js và trạng thái tạm được mutate trong `useFrame` là chủ ý, để thế giới 3D không re-render React mỗi frame.

Khi cần phát hành lên registry riêng, thêm bước build (ví dụ `tsup`) để xuất `dist/` cùng file `.d.ts`; API công khai giữ nguyên.

## Lệnh

```bash
npm install
npm run dev        # app demo
npm test           # test headless của engine
npm run typecheck  # mọi workspace
npm run lint
```

Yêu cầu Node 22.6 trở lên (`.node-version`).

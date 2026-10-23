/// <reference types="next/image-types/global" />

// Kiểu cho `import logo from '*.png'` (BrandLogo của @nexaticket/ui). next-env.d.ts cũng khai báo,
// nhưng nó do `next build` sinh ra và bị gitignore — CI chạy typecheck trước build nên không có nó.

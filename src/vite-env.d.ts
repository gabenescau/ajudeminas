/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZUCKPAY_CLIENT_ID: string
  readonly VITE_ZUCKPAY_CLIENT_SECRET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

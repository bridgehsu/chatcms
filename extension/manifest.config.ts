import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'ChatCMS',
  version: '0.1.0',
  description: '采集网页内容，智能会话与多平台发布助手',
  // 动态渠道脚本主路径：userScripts；debugger 仅作设置里可选高级兜底
  permissions: [
    'storage',
    'sidePanel',
    'tabs',
    'activeTab',
    'scripting',
    'userScripts',
    'debugger',
  ],
  host_permissions: ['<all_urls>', 'http://127.0.0.1:17890/*'],
  minimum_chrome_version: '120',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      js: ['src/content/multipostBridge.ts'],
      matches: ['http://127.0.0.1/*', 'http://localhost/*'],
      run_at: 'document_start',
    },
    {
      js: ['src/content/index.ts'],
      matches: ['<all_urls>'],
      run_at: 'document_idle',
    },
  ],
  action: {
    default_title: 'ChatCMS 智能会话',
  },
  side_panel: {
    default_path: 'popup.html',
  },
})

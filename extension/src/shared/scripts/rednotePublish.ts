/**
 * 小红书图文填表脚本字符串（桌面媒体管理可参考）。
 * 扩展对 DYNAMIC_REDNOTE 实际执行的是 fillRednote.ts（chrome.scripting 函数注入）。
 */
export const DEFAULT_REDNOTE_PUBLISH_SCRIPT = `
throw new Error('小红书请走扩展内置填表函数 fillRednoteInPage，勿依赖此占位字符串');
`.trim()

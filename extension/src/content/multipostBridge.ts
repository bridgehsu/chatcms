/**
 * 本机发布桥页专用 content script（document_start）
 * 对接桌面 BRIDGE_HTML 的 MultiPost postMessage 协议。
 */

import {
  MULTIPOST_PUBLISH,
  MULTIPOST_TRUST,
  isLocalBridgeOrigin,
  isMultipostRequest,
  type MultipostResponse,
} from '../shared/multipost/bridgeProtocol'

function respond(traceId: string, code: number, message?: string, data?: unknown) {
  const payload: MultipostResponse = {
    type: 'response',
    traceId,
    code,
    message,
    data: data ?? null,
  }
  window.postMessage(payload, '*')
}

async function handlePublish(traceId: string, syncData: unknown) {
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'MULTIPOST_PUBLISH',
      syncData,
    })) as { ok?: boolean; error?: string } | undefined

    if (!res?.ok) {
      respond(traceId, 1, res?.error || '发布失败')
      return
    }
    respond(traceId, 0, 'ok')
  } catch (e) {
    respond(
      traceId,
      1,
      e instanceof Error ? e.message : String(e),
    )
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  // 只处理本页发出的请求，避免其它 frame 干扰
  if (event.source !== window) return
  if (!isMultipostRequest(event.data)) return
  if (!isLocalBridgeOrigin(location.origin)) return

  const { traceId, action, data } = event.data

  if (action === MULTIPOST_TRUST) {
    // 本机桥自动信任，无需弹窗
    respond(traceId, 0, 'trusted')
    return
  }

  if (action === MULTIPOST_PUBLISH) {
    void handlePublish(traceId, data)
    return
  }
})

export {}

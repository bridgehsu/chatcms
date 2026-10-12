import type { SyncPayload } from '../publishSync'

/**
 * 小红书创作者页填表（MAIN world，须自包含）。
 * 成功条件：出现 placeholder 含「填写标题」的输入框（空态上传页没有它）。
 *
 * 流程：等发布页 → 切「上传图文」→ 等待 file input → 赋文件 → 填标题/正文
 */
export async function fillRednoteInPage(
  data: SyncPayload,
): Promise<{ ok: true; platform: string } | { ok: false; error: string }> {
  function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms))
  }

  function waitForPredicate(
    pred: () => Element | null,
    timeout: number,
    label: string,
  ): Promise<Element> {
    return new Promise((resolve, reject) => {
      const hit = pred()
      if (hit) {
        resolve(hit)
        return
      }
      const observer = new MutationObserver(() => {
        const el = pred()
        if (el) {
          observer.disconnect()
          resolve(el)
        }
      })
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      })
      setTimeout(() => {
        observer.disconnect()
        reject(new Error(label))
      }, timeout)
    })
  }

  function queryAllDeep(selector: string, root: ParentNode = document): Element[] {
    const out: Element[] = []
    const walk = (node: ParentNode) => {
      if (!('querySelectorAll' in node)) return
      try {
        node.querySelectorAll(selector).forEach((el) => out.push(el))
      } catch {
        /* ignore */
      }
      try {
        node.querySelectorAll('*').forEach((el) => {
          if (el.shadowRoot) walk(el.shadowRoot)
        })
      } catch {
        /* ignore */
      }
    }
    walk(root)
    return out
  }

  function findTitleInput(): HTMLInputElement | null {
    const list = queryAllDeep('input') as HTMLInputElement[]
    return (
      list.find((el) => {
        const ph = el.placeholder || ''
        return ph.includes('填写标题') || ph.includes('可能会有更多赞')
      }) || null
    )
  }

  function findContentEditor(): HTMLElement | null {
    const byPh = queryAllDeep(
      'div[contenteditable="true"], div[role="textbox"]',
    ) as HTMLElement[]
    return (
      byPh.find((el) => {
        const tip =
          el.getAttribute('data-placeholder') ||
          el.getAttribute('placeholder') ||
          ''
        return (
          tip.includes('描述') ||
          tip.includes('正文') ||
          tip.includes('更多的人看到') ||
          (el.isContentEditable && el.getBoundingClientRect().height > 80)
        )
      }) ||
      byPh.find((el) => el.getBoundingClientRect().height > 80) ||
      null
    )
  }

  function editorReady(): Element | null {
    return findTitleInput()
  }

  function assertNotLogin() {
    const href = String(location.href || '')
    if (href.includes('/login') || href.includes('redirectReason=401')) {
      throw new Error('小红书未登录创作者中心，请先扫码登录后再发布')
    }
  }

  function setInputValue(el: HTMLInputElement, value: string) {
    const desc = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )
    desc?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  async function filesFromPayload(): Promise<File[]> {
    const images = data.images || []
    if (!images.length) throw new Error('小红书图文至少需要 1 张配图')
    const files: File[] = []
    for (let i = 0; i < images.length; i++) {
      const info = images[i]
      const res = await fetch(info.url)
      if (!res.ok) throw new Error(`图片拉取失败 HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.size) throw new Error('图片内容为空')
      const type = info.type || blob.type || 'image/jpeg'
      files.push(
        new File([blob], info.name || `image-${i + 1}.jpg`, { type }),
      )
    }
    return files
  }

  function scoreFileInput(el: HTMLInputElement): number {
    const accept = (el.accept || '').toLowerCase()
    const cls = String(el.className || '').toLowerCase()
    let score = 0
    if (
      accept.includes('image') ||
      accept.includes('.jpg') ||
      accept.includes('png') ||
      accept.includes('webp')
    ) {
      score += 10
    }
    if (cls.includes('upload-input')) score += 8
    if (accept.includes('video') && !accept.includes('image')) score -= 20
    if (el.multiple) score += 3
    return score
  }

  function pickFileInputs(): HTMLInputElement[] {
    const all = queryAllDeep(
      'input[type="file"], input.upload-input',
    ) as HTMLInputElement[]
    return all
      .map((el) => ({ el, score: scoreFileInput(el) }))
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.el)
  }

  function clickUploadImageTab(): boolean {
    const titled = Array.from(
      document.querySelectorAll(
        'span.title, span[class*="title"], div[class*="title"]',
      ),
    )
    const btn =
      titled.find((el) => (el.textContent || '').includes('上传图文')) ||
      Array.from(document.querySelectorAll('span, div, button, a')).find((el) => {
        const t = (el.textContent || '').replace(/\s+/g, '')
        return t === '上传图文' || t === '图文'
      })
    if (btn) {
      ;(btn as HTMLElement).click()
      try {
        btn.dispatchEvent(new Event('click', { bubbles: true }))
      } catch {
        /* ignore */
      }
      return true
    }
    return false
  }

  function clickUploadZone(): boolean {
    const zones = Array.from(
      document.querySelectorAll('div, section, label, button'),
    ).filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, '')
      return (
        t.includes('拖拽图片') ||
        t.includes('上传图片') ||
        t.includes('文字配图') ||
        t.includes('点击上传')
      )
    }) as HTMLElement[]
    if (!zones.length) return false
    try {
      zones[0].click()
    } catch {
      /* ignore */
    }
    return true
  }

  function assignFiles(input: HTMLInputElement, files: File[]) {
    const dt = new DataTransfer()
    for (const f of files) dt.items.add(f)
    try {
      input.files = dt.files
    } catch {
      /* some browsers */
    }
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function dropFilesOnPage(files: File[]) {
    const dt = new DataTransfer()
    for (const f of files) dt.items.add(f)

    const candidates = Array.from(
      document.querySelectorAll('div, section, label'),
    ).filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, '')
      return (
        t.includes('拖拽图片') ||
        t.includes('上传图片') ||
        t.includes('文字配图')
      )
    }) as HTMLElement[]

    const zones =
      candidates.length > 0
        ? candidates.slice(0, 8)
        : ([document.body] as HTMLElement[])

    for (const zone of zones) {
      for (const type of ['dragenter', 'dragover', 'drop'] as const) {
        let evt: DragEvent
        try {
          evt = new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          })
        } catch {
          evt = new DragEvent(type, { bubbles: true, cancelable: true })
          Object.defineProperty(evt, 'dataTransfer', { value: dt })
        }
        zone.dispatchEvent(evt)
      }
    }
  }

  try {
    assertNotLogin()
    console.info('[ChatCMS] rednote fill start', {
      images: data.images?.length || 0,
      title: data.title,
      href: location.href,
    })

    if (!editorReady()) {
      try {
        await waitForPredicate(
          () => {
            assertNotLogin()
            if (pickFileInputs().length) return document.body
            if (document.querySelector('span.title, span[class*="title"]')) {
              return document.body
            }
            if (
              Array.from(document.querySelectorAll('span, div, button')).some(
                (el) => {
                  const t = (el.textContent || '').replace(/\s+/g, '')
                  return t.includes('上传图文') || t.includes('上传视频')
                },
              )
            ) {
              return document.body
            }
            return null
          },
          20000,
          '发布页加载超时：未出现上传入口。请确认已登录并打开图文发布页',
        )
      } catch (e) {
        assertNotLogin()
        throw e
      }

      await sleep(800)
      clickUploadImageTab()
      await sleep(1200)
      clickUploadZone()

      const files = await filesFromPayload()
      console.info('[ChatCMS] files ready', files.map((f) => [f.name, f.size, f.type]))

      let inputs: HTMLInputElement[]
      try {
        await waitForPredicate(
          () => {
            assertNotLogin()
            return pickFileInputs()[0] || null
          },
          25000,
          '未找到 input[type=file]，请确认已打开图文发布页（可手动点一次「上传图文」后重试）',
        )
        inputs = pickFileInputs()
      } catch {
        clickUploadImageTab()
        await sleep(1500)
        clickUploadZone()
        await waitForPredicate(
          () => pickFileInputs()[0] || null,
          15000,
          '未找到 input[type=file]，请确认已打开图文发布页',
        )
        inputs = pickFileInputs()
      }

      console.info(
        '[ChatCMS] file inputs',
        inputs.map((el) => ({
          accept: el.accept,
          className: el.className,
          multiple: el.multiple,
        })),
      )

      dropFilesOnPage(files)
      await sleep(500)

      let ready = false
      for (const input of inputs) {
        assignFiles(input, files)
        dropFilesOnPage(files)
        try {
          await waitForPredicate(editorReady, 10000, 'waiting-title')
          ready = true
          break
        } catch {
          /* next input */
        }
      }

      if (!ready) {
        assignFiles(inputs[0], files)
        dropFilesOnPage(files)
        await waitForPredicate(
          editorReady,
          28000,
          '图片未进入编辑态：未出现「填写标题」输入框。请确认已登录创作者中心，且配图为 jpg/png/webp',
        )
      }
    }

    await sleep(600)

    const titleInput = (await waitForPredicate(
      findTitleInput,
      10000,
      '未找到「填写标题」输入框',
    )) as HTMLInputElement

    const titleText = (
      (data.title && String(data.title).trim()) ||
      String(data.content || '').slice(0, 20) ||
      '未命名'
    ).slice(0, 20)
    titleInput.focus()
    setInputValue(titleInput, titleText)
    await sleep(400)

    const contentEditor = (await waitForPredicate(
      findContentEditor,
      10000,
      '未找到正文编辑器',
    )) as HTMLElement

    contentEditor.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(contentEditor)
    sel?.removeAllRanges()
    sel?.addRange(range)

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    })
    pasteEvent.clipboardData!.setData('text/plain', String(data.content || ''))
    const pasted = contentEditor.dispatchEvent(pasteEvent)

    if (!(contentEditor.innerText || '').trim() && data.content) {
      try {
        document.execCommand('insertText', false, String(data.content))
      } catch {
        contentEditor.textContent = String(data.content)
        contentEditor.dispatchEvent(new InputEvent('input', { bubbles: true }))
      }
    }
    console.info('[ChatCMS] content paste', {
      pasted,
      text: contentEditor.innerText?.slice(0, 40),
    })
    await sleep(400)

    return { ok: true, platform: data.platform || 'DYNAMIC_REDNOTE' }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[ChatCMS] rednote fill failed', error)
    return { ok: false, error }
  }
}

/**
 * 小红书图文填表（纯 JS，经 chrome.scripting.executeScript files 注入 MAIN world）。
 * 入参：window.__CHATCMS_SYNC__
 * 出参：window.__CHATCMS_RESULT__ = { ok, error?, platform? }
 *
 * 流程对齐 MultiPost DynamicRednote + social-auto-upload：
 * 等发布页 → 切「上传图文」→ 等待 file input → 赋文件 → 填标题/正文
 */
;(async function () {
  var data = window.__CHATCMS_SYNC__
  function done(result) {
    window.__CHATCMS_RESULT__ = result
  }

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms)
    })
  }

  function waitForPredicate(pred, timeout, label) {
    return new Promise(function (resolve, reject) {
      var hit = pred()
      if (hit) {
        resolve(hit)
        return
      }
      var observer = new MutationObserver(function () {
        var el = pred()
        if (el) {
          observer.disconnect()
          resolve(el)
        }
      })
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      })
      setTimeout(function () {
        observer.disconnect()
        reject(new Error(label))
      }, timeout)
    })
  }

  /** 含 open Shadow DOM */
  function queryAllDeep(selector, root) {
    root = root || document
    var out = []
    function walk(node) {
      if (!node || !node.querySelectorAll) return
      try {
        node.querySelectorAll(selector).forEach(function (el) {
          out.push(el)
        })
      } catch (e) {}
      try {
        node.querySelectorAll('*').forEach(function (el) {
          if (el.shadowRoot) walk(el.shadowRoot)
        })
      } catch (e) {}
    }
    walk(root)
    return out
  }

  function findTitleInput() {
    var list = queryAllDeep('input')
    return (
      list.find(function (el) {
        var ph = el.placeholder || ''
        return ph.indexOf('填写标题') !== -1 || ph.indexOf('可能会有更多赞') !== -1
      }) || null
    )
  }

  function findContentEditor() {
    var byPh = queryAllDeep('div[contenteditable="true"], div[role="textbox"]')
    return (
      byPh.find(function (el) {
        var tip =
          el.getAttribute('data-placeholder') || el.getAttribute('placeholder') || ''
        return (
          tip.indexOf('描述') !== -1 ||
          tip.indexOf('正文') !== -1 ||
          tip.indexOf('更多的人看到') !== -1 ||
          (el.isContentEditable && el.getBoundingClientRect().height > 80)
        )
      }) ||
      byPh.find(function (el) {
        return el.getBoundingClientRect().height > 80
      }) ||
      null
    )
  }

  function editorReady() {
    return findTitleInput()
  }

  function assertNotLogin() {
    var href = String(location.href || '')
    if (
      href.indexOf('/login') !== -1 ||
      href.indexOf('redirectReason=401') !== -1
    ) {
      throw new Error('小红书未登录创作者中心，请先扫码登录后再发布')
    }
  }

  function setInputValue(el, value) {
    var desc = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )
    if (desc && desc.set) desc.set.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  async function filesFromPayload() {
    var images = (data && data.images) || []
    if (!images.length) throw new Error('小红书图文至少需要 1 张配图')
    var files = []
    for (var i = 0; i < images.length; i++) {
      var info = images[i]
      var res = await fetch(info.url)
      if (!res.ok) throw new Error('图片拉取失败 HTTP ' + res.status)
      var blob = await res.blob()
      if (!blob.size) throw new Error('图片内容为空')
      var type = info.type || blob.type || 'image/jpeg'
      files.push(
        new File([blob], info.name || 'image-' + (i + 1) + '.jpg', { type: type }),
      )
    }
    return files
  }

  function scoreFileInput(el) {
    var accept = (el.accept || '').toLowerCase()
    var cls = String(el.className || '').toLowerCase()
    var score = 0
    if (
      accept.indexOf('image') !== -1 ||
      accept.indexOf('.jpg') !== -1 ||
      accept.indexOf('png') !== -1 ||
      accept.indexOf('webp') !== -1
    ) {
      score += 10
    }
    if (cls.indexOf('upload-input') !== -1) score += 8
    if (accept.indexOf('video') !== -1 && accept.indexOf('image') === -1) score -= 20
    if (el.multiple) score += 3
    return score
  }

  function pickFileInputs() {
    var all = queryAllDeep('input[type="file"], input.upload-input')
    return all
      .map(function (el) {
        return { el: el, score: scoreFileInput(el) }
      })
      .filter(function (s) {
        return s.score >= 0
      })
      .sort(function (a, b) {
        return b.score - a.score
      })
      .map(function (s) {
        return s.el
      })
  }

  function clickUploadImageTab() {
    // MultiPost：span.title 含「上传图文」
    var titled = Array.prototype.slice.call(
      document.querySelectorAll('span.title, span[class*="title"], div[class*="title"]'),
    )
    var btn =
      titled.find(function (el) {
        return (el.textContent || '').indexOf('上传图文') !== -1
      }) ||
      Array.prototype.slice
        .call(document.querySelectorAll('span, div, button, a'))
        .find(function (el) {
          var t = (el.textContent || '').replace(/\s+/g, '')
          return t === '上传图文' || t === '图文'
        })
    if (btn) {
      btn.click()
      try {
        btn.dispatchEvent(new Event('click', { bubbles: true }))
      } catch (e) {}
      return true
    }
    return false
  }

  function clickUploadZone() {
    var zones = Array.prototype.slice
      .call(document.querySelectorAll('div, section, label, button'))
      .filter(function (el) {
        var t = (el.textContent || '').replace(/\s+/g, '')
        return (
          t.indexOf('拖拽图片') !== -1 ||
          t.indexOf('上传图片') !== -1 ||
          t.indexOf('文字配图') !== -1 ||
          t.indexOf('点击上传') !== -1
        )
      })
    if (!zones.length) return false
    try {
      zones[0].click()
    } catch (e) {}
    return true
  }

  function assignFiles(input, files) {
    var dt = new DataTransfer()
    for (var i = 0; i < files.length; i++) dt.items.add(files[i])
    try {
      input.files = dt.files
    } catch (e) {}
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function dropFilesOnPage(files) {
    var dt = new DataTransfer()
    for (var i = 0; i < files.length; i++) dt.items.add(files[i])
    var candidates = Array.prototype.slice
      .call(document.querySelectorAll('div, section, label'))
      .filter(function (el) {
        var t = (el.textContent || '').replace(/\s+/g, '')
        return (
          t.indexOf('拖拽图片') !== -1 ||
          t.indexOf('上传图片') !== -1 ||
          t.indexOf('文字配图') !== -1
        )
      })
    var zones = candidates.length ? candidates.slice(0, 8) : [document.body]
    for (var z = 0; z < zones.length; z++) {
      var zone = zones[z]
      ;['dragenter', 'dragover', 'drop'].forEach(function (type) {
        var evt
        try {
          evt = new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          })
        } catch (e) {
          evt = new DragEvent(type, { bubbles: true, cancelable: true })
          Object.defineProperty(evt, 'dataTransfer', { value: dt })
        }
        zone.dispatchEvent(evt)
      })
    }
  }

  try {
    if (!data) throw new Error('缺少 __CHATCMS_SYNC__')
    assertNotLogin()
    console.info('[ChatCMS] fill-rednote start', data.images && data.images.length, location.href)

    if (!editorReady()) {
      // 等发布页壳子（SPA）
      try {
        await waitForPredicate(
          function () {
            assertNotLogin()
            if (pickFileInputs().length) return document.body
            if (document.querySelector('span.title, span[class*="title"]')) return document.body
            if (
              Array.prototype.slice
                .call(document.querySelectorAll('span, div, button'))
                .some(function (el) {
                  var t = (el.textContent || '').replace(/\s+/g, '')
                  return t.indexOf('上传图文') !== -1 || t.indexOf('上传视频') !== -1
                })
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

      var files = await filesFromPayload()
      console.info('[ChatCMS] files ready', files.length)

      // 关键：等 file input 出现（创作者站常是异步挂载）
      var inputs
      try {
        await waitForPredicate(
          function () {
            assertNotLogin()
            var list = pickFileInputs()
            return list.length ? list[0] : null
          },
          25000,
          '未找到 input[type=file]，请确认已打开图文发布页（可手动点一次「上传图文」后重试）',
        )
        inputs = pickFileInputs()
      } catch (e) {
        clickUploadImageTab()
        await sleep(1500)
        clickUploadZone()
        await waitForPredicate(
          function () {
            return pickFileInputs()[0] || null
          },
          15000,
          '未找到 input[type=file]，请确认已打开图文发布页',
        )
        inputs = pickFileInputs()
      }

      console.info(
        '[ChatCMS] file inputs',
        inputs.map(function (el) {
          return { accept: el.accept, className: el.className, multiple: el.multiple }
        }),
      )

      dropFilesOnPage(files)
      await sleep(400)

      var ready = false
      for (var i = 0; i < inputs.length; i++) {
        assignFiles(inputs[i], files)
        dropFilesOnPage(files)
        try {
          await waitForPredicate(editorReady, 10000, 'waiting-title')
          ready = true
          break
        } catch (e) {}
      }

      if (!ready) {
        assignFiles(inputs[0], files)
        dropFilesOnPage(files)
        await waitForPredicate(
          editorReady,
          28000,
          '图片未进入编辑态：未出现「填写标题」。请确认已登录，配图为 jpg/png/webp',
        )
      }
    }

    await sleep(500)
    var titleInput = await waitForPredicate(findTitleInput, 10000, '未找到「填写标题」')
    var titleText = (
      (data.title && String(data.title).trim()) ||
      String(data.content || '').slice(0, 20) ||
      '未命名'
    ).slice(0, 20)
    titleInput.focus()
    setInputValue(titleInput, titleText)
    await sleep(300)

    var contentEditor = await waitForPredicate(findContentEditor, 10000, '未找到正文编辑器')
    contentEditor.focus()
    var pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    })
    pasteEvent.clipboardData.setData('text/plain', String(data.content || ''))
    contentEditor.dispatchEvent(pasteEvent)
    if (!(contentEditor.innerText || '').trim() && data.content) {
      try {
        document.execCommand('insertText', false, String(data.content))
      } catch (e) {
        contentEditor.textContent = String(data.content)
        contentEditor.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }

    done({ ok: true, platform: data.platform || 'DYNAMIC_REDNOTE' })
    console.info('[ChatCMS] fill-rednote ok')
  } catch (e) {
    var error = e && e.message ? e.message : String(e)
    console.error('[ChatCMS] fill-rednote fail', error)
    done({ ok: false, error: error })
  }
})()

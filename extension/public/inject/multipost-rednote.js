/**
 * 从 MultiPost Extension src/sync/dynamic/rednote.ts 原样移植
 * @see https://github.com/leaperone/MultiPost-Extension
 *
 * 入参：window.__CHATCMS_SYNC__ = SyncData
 *   {
 *     platforms: [...],
 *     isAutoPublish: boolean,
 *     data: { title, content, images: FileData[], videos?, tags? }
 *   }
 * 出参：window.__CHATCMS_RESULT__ = { ok, error? }
 */
;(async function () {
  var syncData = window.__CHATCMS_SYNC__

  function done(result) {
    window.__CHATCMS_RESULT__ = result
  }

  // —— 以下为 MultiPost DynamicRednote（仅将 silent return 改为 throw，避免假成功）——
  async function DynamicRednote(data) {
    var dynamic = data.data || {}
    var title = dynamic.title
    var content = dynamic.content
    var images = dynamic.images
    var tags = dynamic.tags

    function waitForElement(selector, timeout) {
      timeout = timeout === undefined ? 10000 : timeout
      return new Promise(function (resolve, reject) {
        var element = document.querySelector(selector)
        if (element) {
          resolve(element)
          return
        }
        var observer = new MutationObserver(function () {
          var el = document.querySelector(selector)
          if (el) {
            observer.disconnect()
            resolve(el)
          }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        setTimeout(function () {
          observer.disconnect()
          reject(
            new Error(
              'Element with selector "' + selector + '" not found within ' + timeout + 'ms',
            ),
          )
        }, timeout)
      })
    }

    async function uploadImages() {
      var fileInput = await waitForElement('input[type="file"]')
      if (!fileInput) {
        throw new Error('未找到文件输入元素')
      }

      var dataTransfer = new DataTransfer()

      for (var i = 0; i < images.length; i++) {
        var fileInfo = images[i]
        try {
          var response = await fetch(fileInfo.url)
          if (!response.ok) {
            throw new Error('HTTP 错误! 状态: ' + response.status)
          }
          var blob = await response.blob()
          var file = new File([blob], fileInfo.name, {
            type: fileInfo.type || blob.type || 'image/jpeg',
          })
          dataTransfer.items.add(file)
        } catch (error) {
          console.error('上传图片 ' + fileInfo.url + ' 失败:', error)
        }
      }

      if (dataTransfer.files.length > 0) {
        fileInput.files = dataTransfer.files
        fileInput.dispatchEvent(new Event('change', { bubbles: true }))
        await new Promise(function (resolve) {
          setTimeout(resolve, 2000)
        })
        console.log('文件上传操作完成')
      } else {
        throw new Error('没有成功添加任何文件')
      }
    }

    if (!(images && images.length > 0)) {
      throw new Error('MultiPost 小红书图文需要至少 1 张图片')
    }

    // 等待页面加载
    await waitForElement('span[class="title"]')
    await new Promise(function (resolve) {
      setTimeout(resolve, 1000)
    })

    // 点击上传图文按钮
    var uploadButtons = document.querySelectorAll('span[class="title"]')
    var uploadButton = Array.prototype.slice.call(uploadButtons).find(function (element) {
      return (element.textContent || '').indexOf('上传图文') !== -1
    })

    if (!uploadButton) {
      throw new Error('未找到上传图文按钮')
    }

    uploadButton.click()
    uploadButton.dispatchEvent(new Event('click', { bubbles: true }))
    await new Promise(function (resolve) {
      setTimeout(resolve, 1000)
    })

    // 上传文件
    await uploadImages()
    await new Promise(function (resolve) {
      setTimeout(resolve, 5000)
    })

    // 填写标题
    var titleInput = await waitForElement('input[type="text"]')
    if (titleInput) {
      var titleText = title || (content && content.slice(0, 20)) || ''
      titleInput.value = titleText
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    }

    // 填写内容
    var contentEditor = await waitForElement('div[contenteditable="true"]')
    if (contentEditor) {
      contentEditor.focus()
      var contentPasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      })
      var tagSuffix =
        tags && tags.length
          ? ' ' +
            tags
              .map(function (t) {
                return '#' + t + '#'
              })
              .join(' ')
          : ''
      contentPasteEvent.clipboardData.setData(
        'text/plain',
        (content || '') + tagSuffix,
      )
      contentEditor.dispatchEvent(contentPasteEvent)
      await new Promise(function (resolve) {
        setTimeout(resolve, 1000)
      })
      contentEditor.blur()
      console.log('设置内容:', content)
    }

    // 自动发布
    if (data.isAutoPublish) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 2000)
      })
      var buttons = document.querySelectorAll('button')
      var publishButton = Array.prototype.slice.call(buttons).find(function (button) {
        return (button.textContent || '').indexOf('发布') !== -1
      })

      if (publishButton) {
        while (publishButton.getAttribute('aria-disabled') === 'true') {
          await new Promise(function (resolve) {
            setTimeout(resolve, 1000)
          })
          console.log('等待发布按钮可用...')
        }
        console.log('点击发布按钮')
        publishButton.click()
        await new Promise(function (resolve) {
          setTimeout(resolve, 10000)
        })
        window.location.href = 'https://creator.xiaohongshu.com/new/note-manager'
      }
    }
  }

  try {
    if (!syncData) throw new Error('缺少 __CHATCMS_SYNC__（SyncData）')
    console.info('[ChatCMS/MultiPost] DynamicRednote start', syncData)
    await DynamicRednote(syncData)
    done({ ok: true, platform: 'DYNAMIC_REDNOTE' })
    console.info('[ChatCMS/MultiPost] DynamicRednote done')
  } catch (e) {
    var msg = e && e.message ? e.message : String(e)
    console.error('[ChatCMS/MultiPost] DynamicRednote fail', msg)
    done({ ok: false, error: msg })
  }
})()

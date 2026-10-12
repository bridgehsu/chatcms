/** MultiPost 平台目录（从 leaperone/MultiPost-Extension 同步：injectUrl / homeUrl） */

export type PublishKind = 'dynamic' | 'video' | 'article' | 'podcast'

export type PublishPlatform = {
  id: string
  name: string
  injectUrl: string
  homeUrl: string
  kind: PublishKind
  /** cn | intl */
  region: 'cn' | 'intl'
  /** 扩展内已对接自动填表（目前仅小红书动态） */
  hasBuiltinScript?: boolean
}

export const MULTIPOST_PLATFORMS: PublishPlatform[] = [
  { id: 'DYNAMIC_BILIBILI', name: '哔哩哔哩', kind: 'dynamic', region: 'cn', injectUrl: 'https://t.bilibili.com', homeUrl: 'https://t.bilibili.com', hasBuiltinScript: false },
  { id: 'DYNAMIC_DOUYIN', name: '抖音', kind: 'dynamic', region: 'cn', injectUrl: 'https://creator.douyin.com/creator-micro/content/upload?default-tab=3', homeUrl: 'https://creator.douyin.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_X', name: 'X', kind: 'dynamic', region: 'intl', injectUrl: 'https://x.com/home', homeUrl: 'https://x.com/home', hasBuiltinScript: false },
  { id: 'DYNAMIC_REDNOTE', name: '小红书', kind: 'dynamic', region: 'cn', injectUrl: 'https://creator.xiaohongshu.com/publish/publish?from=homepage&target=image', homeUrl: 'https://creator.xiaohongshu.com/', hasBuiltinScript: true },
  { id: 'DYNAMIC_WEIBO', name: '微博', kind: 'dynamic', region: 'cn', injectUrl: 'https://weibo.com', homeUrl: 'https://weibo.com', hasBuiltinScript: false },
  { id: 'DYNAMIC_XUEQIU', name: '雪球', kind: 'dynamic', region: 'cn', injectUrl: 'https://xueqiu.com', homeUrl: 'https://xueqiu.com', hasBuiltinScript: false },
  { id: 'DYNAMIC_ZHIHU', name: '知乎想法', kind: 'dynamic', region: 'cn', injectUrl: 'https://www.zhihu.com', homeUrl: 'https://www.zhihu.com', hasBuiltinScript: false },
  { id: 'DYNAMIC_INSTAGRAM', name: 'Instagram', kind: 'dynamic', region: 'intl', injectUrl: 'https://www.instagram.com/', homeUrl: 'https://www.instagram.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_FACEBOOK', name: 'Facebook', kind: 'dynamic', region: 'intl', injectUrl: 'https://www.facebook.com/', homeUrl: 'https://www.facebook.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_LINKEDIN', name: 'LinkedIn', kind: 'dynamic', region: 'intl', injectUrl: 'https://www.linkedin.com/feed', homeUrl: 'https://www.linkedin.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_OKJIKE', name: '即刻', kind: 'dynamic', region: 'cn', injectUrl: 'https://web.okjike.com', homeUrl: 'https://web.okjike.com', hasBuiltinScript: false },
  { id: 'DYNAMIC_REDDIT', name: 'Reddit', kind: 'dynamic', region: 'intl', injectUrl: 'https://www.reddit.com/submit?type=IMAGE', homeUrl: 'https://www.reddit.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_PINTEREST', name: 'Pinterest', kind: 'dynamic', region: 'intl', injectUrl: 'https://www.pinterest.com/pin-creation-tool/', homeUrl: 'https://www.pinterest.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_KUAISHOU', name: '快手', kind: 'dynamic', region: 'cn', injectUrl: 'https://cp.kuaishou.com/article/publish/video', homeUrl: 'https://cp.kuaishou.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_SOHUTV', name: '搜狐视频', kind: 'dynamic', region: 'cn', injectUrl: 'https://tv.sohu.com/s/center/', homeUrl: 'https://tv.sohu.com/s/center/', hasBuiltinScript: false },
  { id: 'DYNAMIC_BAIJIAHAO', name: '百家号动态', kind: 'dynamic', region: 'cn', injectUrl: 'https://baijiahao.baidu.com/builder/rc/edit?type=events', homeUrl: 'https://baijiahao.baidu.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_TOUTIAO', name: '微头条', kind: 'dynamic', region: 'cn', injectUrl: 'https://mp.toutiao.com/profile_v4/weitoutiao/publish', homeUrl: 'https://mp.toutiao.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_THREADS', name: 'Threads', kind: 'dynamic', region: 'intl', injectUrl: 'https://www.threads.net/web', homeUrl: 'https://www.threads.net/web', hasBuiltinScript: false },
  { id: 'DYNAMIC_WEIXINCHANNEL', name: '视频号动态', kind: 'dynamic', region: 'cn', injectUrl: 'https://channels.weixin.qq.com/platform/post/finderNewLifeCreate', homeUrl: 'https://channels.weixin.qq.com/platform', hasBuiltinScript: false },
  { id: 'DYNAMIC_BLUESKY', name: 'Bluesky', kind: 'dynamic', region: 'intl', injectUrl: 'https://bsky.app/', homeUrl: 'https://bsky.app/', hasBuiltinScript: false },
  { id: 'DYNAMIC_V2EX', name: 'V2EX', kind: 'dynamic', region: 'cn', injectUrl: 'https://www.v2ex.com/write', homeUrl: 'https://www.v2ex.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_DOUBAN', name: '豆瓣', kind: 'dynamic', region: 'cn', injectUrl: 'https://www.douban.com/', homeUrl: 'https://www.douban.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_DEDAO', name: '得到', kind: 'dynamic', region: 'cn', injectUrl: 'https://www.dedao.cn/knowledge/home', homeUrl: 'https://www.dedao.cn/', hasBuiltinScript: false },
  { id: 'DYNAMIC_WEIXIN', name: '公众号动态', kind: 'dynamic', region: 'cn', injectUrl: 'https://mp.weixin.qq.com/', homeUrl: 'https://mp.weixin.qq.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_WEBHOOK', name: 'Webhook', kind: 'dynamic', region: 'intl', injectUrl: 'https://multipost.app/about/', homeUrl: 'https://multipost.app/about/', hasBuiltinScript: false },
  { id: 'DYNAMIC_ZSXQ', name: '知识星球', kind: 'dynamic', region: 'cn', injectUrl: 'https://wx.zsxq.com/', homeUrl: 'https://wx.zsxq.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_XIAOHEIHE', name: '小黑盒', kind: 'dynamic', region: 'cn', injectUrl: 'https://www.xiaoheihe.cn/creator/editor/draft/image_text', homeUrl: 'https://www.xiaoheihe.cn/', hasBuiltinScript: false },
  { id: 'DYNAMIC_TOUTIAOHAO', name: '头条号动态', kind: 'dynamic', region: 'cn', injectUrl: 'https://mp.toutiao.com/profile_v4/weitoutiao/publish', homeUrl: 'https://www.toutiao.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_SUBSTACK', name: 'Substack', kind: 'dynamic', region: 'intl', injectUrl: 'https://substack.com/home', homeUrl: 'https://substack.com/', hasBuiltinScript: false },
  { id: 'DYNAMIC_MAIMAI', name: '脉脉', kind: 'dynamic', region: 'cn', injectUrl: 'https://maimai.cn/community/home/following', homeUrl: 'https://maimai.cn/', hasBuiltinScript: false },
  { id: 'DYNAMIC_JUEJIN', name: '掘金沸点', kind: 'dynamic', region: 'cn', injectUrl: 'https://juejin.cn/pins', homeUrl: 'https://juejin.cn/', hasBuiltinScript: false },
  { id: 'VIDEO_BILIBILI', name: '哔哩哔哩', kind: 'video', region: 'cn', injectUrl: 'https://member.bilibili.com/platform/upload/video/frame', homeUrl: 'https://member.bilibili.com/', hasBuiltinScript: false },
  { id: 'VIDEO_DOUYIN', name: '抖音', kind: 'video', region: 'cn', injectUrl: 'https://creator.douyin.com/creator-micro/content/upload', homeUrl: 'https://creator.douyin.com/', hasBuiltinScript: false },
  { id: 'VIDEO_YOUTUBE', name: 'YouTube', kind: 'video', region: 'intl', injectUrl: 'https://studio.youtube.com/', homeUrl: 'https://studio.youtube.com/', hasBuiltinScript: false },
  { id: 'VIDEO_REDNOTE', name: '小红书', kind: 'video', region: 'cn', injectUrl: 'https://creator.xiaohongshu.com/publish/publish?target=video', homeUrl: 'https://creator.xiaohongshu.com', hasBuiltinScript: false },
  { id: 'VIDEO_TIKTOK', name: 'TikTok', kind: 'video', region: 'intl', injectUrl: 'https://www.tiktok.com/tiktokstudio/upload', homeUrl: 'https://www.tiktok.com/tiktokstudio', hasBuiltinScript: false },
  { id: 'VIDEO_WEIXINCHANNEL', name: '视频号', kind: 'video', region: 'cn', injectUrl: 'https://channels.weixin.qq.com/platform/post/create', homeUrl: 'https://channels.weixin.qq.com/platform', hasBuiltinScript: false },
  { id: 'VIDEO_KUAISHOU', name: '快手', kind: 'video', region: 'cn', injectUrl: 'https://cp.kuaishou.com/article/publish/video', homeUrl: 'https://cp.kuaishou.com/', hasBuiltinScript: false },
  { id: 'VIDEO_BAIJIAHAO', name: '百家号', kind: 'video', region: 'cn', injectUrl: 'https://baijiahao.baidu.com/builder/rc/edit?type=videoV2', homeUrl: 'https://baijiahao.baidu.com/', hasBuiltinScript: false },
  { id: 'VIDEO_WEIBO', name: '微博', kind: 'video', region: 'cn', injectUrl: 'https://weibo.com/upload/channel', homeUrl: 'https://weibo.com/', hasBuiltinScript: false },
  { id: 'VIDEO_OKJIKE', name: '即刻', kind: 'video', region: 'cn', injectUrl: 'https://web.okjike.com', homeUrl: 'https://web.okjike.com', hasBuiltinScript: false },
  { id: 'VIDEO_BLUESKY', name: 'Bluesky', kind: 'video', region: 'intl', injectUrl: 'https://bsky.app/', homeUrl: 'https://bsky.app/', hasBuiltinScript: false },
  { id: 'VIDEO_ZHIHU', name: '知乎视频', kind: 'video', region: 'cn', injectUrl: 'https://www.zhihu.com/zvideo/upload-video', homeUrl: 'https://www.zhihu.com/', hasBuiltinScript: false },
  { id: 'VIDEO_EASTMONEY', name: '东方财富', kind: 'video', region: 'cn', injectUrl: 'https://mp.eastmoney.com/collect/pc_writer/index.html#/publish/video', homeUrl: 'https://www.eastmoney.com/', hasBuiltinScript: false },
  { id: 'VIDEO_XIAOHEIHE', name: '小黑盒', kind: 'video', region: 'cn', injectUrl: 'https://www.xiaoheihe.cn/creator/editor/draft/video', homeUrl: 'https://www.xiaoheihe.cn/', hasBuiltinScript: false },
  { id: 'VIDEO_TOUTIAOHAO', name: '西瓜视频', kind: 'video', region: 'cn', injectUrl: 'https://mp.toutiao.com/profile_v4/xigua/upload-video', homeUrl: 'https://www.toutiao.com/', hasBuiltinScript: false },
  { id: 'VIDEO_QIE', name: '企鹅号', kind: 'video', region: 'cn', injectUrl: 'https://om.qq.com/main/creation/video', homeUrl: 'https://om.qq.com/', hasBuiltinScript: false },
  { id: 'VIDEO_CHEJIAHAO', name: '车家号', kind: 'video', region: 'cn', injectUrl: 'https://creator.autohome.com.cn/web/publish/video', homeUrl: 'https://creator.autohome.com.cn/', hasBuiltinScript: false },
  { id: 'VIDEO_DEWU', name: '得物', kind: 'video', region: 'cn', injectUrl: 'https://creator.dewu.com/release', homeUrl: 'https://creator.dewu.com/', hasBuiltinScript: false },
  { id: 'VIDEO_YICHE', name: '易车', kind: 'video', region: 'cn', injectUrl: 'https://mp.yiche.com/videos/video', homeUrl: 'https://mp.yiche.com/', hasBuiltinScript: false },
  { id: 'VIDEO_SOHU', name: '搜狐号', kind: 'video', region: 'cn', injectUrl: 'https://mp.sohu.com/mpfe/v4/contentManagement/news/addvideo', homeUrl: 'https://mp.sohu.com', hasBuiltinScript: false },
  { id: 'VIDEO_SOHUTV', name: '搜狐视频', kind: 'video', region: 'cn', injectUrl: 'https://tv.sohu.com/s/center/', homeUrl: 'https://tv.sohu.com/s/center/', hasBuiltinScript: false },
  { id: 'VIDEO_NETEASE', name: '网易号', kind: 'video', region: 'cn', injectUrl: 'http://mp.163.com/subscribe_v4/index.html#/home', homeUrl: 'http://mp.163.com/', hasBuiltinScript: false },
  { id: 'VIDEO_DAYU', name: '大鱼号', kind: 'video', region: 'cn', injectUrl: 'https://mp.dayu.com/dashboard/video/write', homeUrl: 'https://mp.dayu.com/', hasBuiltinScript: false },
  { id: 'VIDEO_ALIPAY', name: '支付宝', kind: 'video', region: 'cn', injectUrl: 'https://c.alipay.com/page/content-creation/publish/short-video', homeUrl: 'https://sweb.alipay.com', hasBuiltinScript: false },
  { id: 'VIDEO_YIDIAN', name: '一点号', kind: 'video', region: 'cn', injectUrl: 'https://mp.yidianzixun.com/', homeUrl: 'https://mp.yidianzixun.com/', hasBuiltinScript: false },
  { id: 'VIDEO_PINDUODUO', name: '拼多多', kind: 'video', region: 'cn', injectUrl: 'https://live.pinduoduo.com/creator/live-record', homeUrl: 'https://live.pinduoduo.com/', hasBuiltinScript: false },
  { id: 'VIDEO_VIVOVIDEO', name: 'vivo 短视频', kind: 'video', region: 'cn', injectUrl: 'https://kaixinkan.vivo.com.cn/#/home', homeUrl: 'https://kaixinkan.vivo.com.cn/', hasBuiltinScript: false },
  { id: 'VIDEO_IQIYI', name: '爱奇艺', kind: 'video', region: 'cn', injectUrl: 'https://mp.iqiyi.com/sns/publishv2/video', homeUrl: 'https://mp.iqiyi.com/', hasBuiltinScript: false },
  { id: 'VIDEO_YOUKU', name: '优酷', kind: 'video', region: 'cn', injectUrl: 'https://mp.youku.com/v2/manage/upload', homeUrl: 'https://mp.youku.com/', hasBuiltinScript: false },
  { id: 'VIDEO_TENCENTVIDEO', name: '腾讯视频', kind: 'video', region: 'cn', injectUrl: 'https://cm.v.qq.com/upload', homeUrl: 'https://v.qq.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_CNBLOGS', name: '博客园', kind: 'article', region: 'cn', injectUrl: 'https://i.cnblogs.com/articles/edit', homeUrl: 'https://i.cnblogs.com/articles/edit', hasBuiltinScript: false },
  { id: 'ARTICLE_CSDN', name: 'CSDN', kind: 'article', region: 'cn', injectUrl: 'https://mp.csdn.net/mp_blog/creation/editor', homeUrl: 'https://mp.csdn.net/mp_blog/creation/editor', hasBuiltinScript: false },
  { id: 'ARTICLE_ZHIHU', name: '知乎文章', kind: 'article', region: 'cn', injectUrl: 'https://zhuanlan.zhihu.com/write', homeUrl: 'https://zhuanlan.zhihu.com/write', hasBuiltinScript: false },
  { id: 'ARTICLE_JUEJIN', name: '掘金文章', kind: 'article', region: 'cn', injectUrl: 'https://juejin.cn/editor/drafts/new?v=2', homeUrl: 'https://juejin.cn/editor/drafts/new?v=2', hasBuiltinScript: false },
  { id: 'ARTICLE_JIANSHU', name: '简书', kind: 'article', region: 'cn', injectUrl: 'https://www.jianshu.com/writer', homeUrl: 'https://www.jianshu.com/writer', hasBuiltinScript: false },
  { id: 'ARTICLE_SEGMENTFAULT', name: 'SegmentFault', kind: 'article', region: 'cn', injectUrl: 'https://segmentfault.com/write', homeUrl: 'https://segmentfault.com/write', hasBuiltinScript: false },
  { id: 'ARTICLE_ALIYUN', name: '阿里云开发者', kind: 'article', region: 'cn', injectUrl: 'https://developer.aliyun.com/article/new', homeUrl: 'https://developer.aliyun.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_TENCENTYUN', name: '腾讯云开发者', kind: 'article', region: 'cn', injectUrl: 'https://cloud.tencent.com/developer/article/write-new', homeUrl: 'https://cloud.tencent.com/developer', hasBuiltinScript: false },
  { id: 'ARTICLE_VOLCENGINE', name: '火山引擎', kind: 'article', region: 'cn', injectUrl: 'https://developer.volcengine.com/articles/draft', homeUrl: 'https://developer.volcengine.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_BAIJIAHAO', name: '百家号', kind: 'article', region: 'cn', injectUrl: 'https://baijiahao.baidu.com/builder/rc/edit?type=news', homeUrl: 'https://baijiahao.baidu.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_TOUTIAO', name: '头条号文章', kind: 'article', region: 'cn', injectUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish', homeUrl: 'https://mp.toutiao.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_QQ', name: '企鹅号', kind: 'article', region: 'cn', injectUrl: 'https://om.qq.com/main/creation/article', homeUrl: 'https://om.qq.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_DOUBAN', name: '豆瓣日记', kind: 'article', region: 'cn', injectUrl: 'https://www.douban.com/note/create', homeUrl: 'https://www.douban.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_WEIXIN', name: '微信公众号', kind: 'article', region: 'cn', injectUrl: 'https://mp.weixin.qq.com/', homeUrl: 'https://mp.weixin.qq.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_WORDPRESS', name: 'WordPress', kind: 'article', region: 'intl', injectUrl: 'https://wordpress.com/wp-admin/new-post.php', homeUrl: 'https://wordpress.com/wp-admin/', hasBuiltinScript: false },
  { id: 'ARTICLE_BILIBILI', name: 'B站专栏', kind: 'article', region: 'cn', injectUrl: 'https://member.bilibili.com/article-text/home?newEditor=-1', homeUrl: 'https://www.bilibili.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_SSPAI', name: '少数派', kind: 'article', region: 'cn', injectUrl: 'https://sspai.com/write', homeUrl: 'https://sspai.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_51CTO', name: '51CTO', kind: 'article', region: 'cn', injectUrl: 'https://blog.51cto.com/blogger/publish?old=1', homeUrl: 'https://www.51cto.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_XUEQIU', name: '雪球', kind: 'article', region: 'cn', injectUrl: 'https://mp.xueqiu.com/writeV2?position=pc_home_primary', homeUrl: 'https://xueqiu.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_WEIBO', name: '微博文章', kind: 'article', region: 'cn', injectUrl: 'https://card.weibo.com/article/v5/editor', homeUrl: 'https://weibo.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_EASTMONEY', name: '东方财富', kind: 'article', region: 'cn', injectUrl: 'https://mp.eastmoney.com/collect/pc_article/index.html', homeUrl: 'https://www.eastmoney.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_SUBSTACK', name: 'Substack', kind: 'article', region: 'intl', injectUrl: 'https://substack.com/publish/post', homeUrl: 'https://substack.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_MEDIUM', name: 'Medium', kind: 'article', region: 'intl', injectUrl: 'https://medium.com/new-story', homeUrl: 'https://medium.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_OSCHINA', name: '开源中国', kind: 'article', region: 'cn', injectUrl: 'https://my.oschina.net/new/blog', homeUrl: 'https://www.oschina.net/', hasBuiltinScript: false },
  { id: 'ARTICLE_INFOQ', name: 'InfoQ', kind: 'article', region: 'cn', injectUrl: 'https://xie.infoq.cn/', homeUrl: 'https://www.infoq.cn/', hasBuiltinScript: false },
  { id: 'ARTICLE_SMZDM', name: '什么值得买', kind: 'article', region: 'cn', injectUrl: 'https://zhiyou.smzdm.com/user/article/post', homeUrl: 'https://www.smzdm.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_WOSHIPM', name: '人人都是产品经理', kind: 'article', region: 'cn', injectUrl: 'https://www.woshipm.com/wp-admin/post-new.php', homeUrl: 'https://www.woshipm.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_GELONGHUI', name: '格隆汇', kind: 'article', region: 'cn', injectUrl: 'https://www.gelonghui.com/articleCreate/', homeUrl: 'https://www.gelonghui.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_JIANKANGJIE', name: '健康界', kind: 'article', region: 'cn', injectUrl: 'https://ucenter.cn-healthcare.com/article/revision/newedit', homeUrl: 'https://www.cn-healthcare.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_KAIDIWANG', name: '凯迪', kind: 'article', region: 'cn', injectUrl: 'https://www.9kd.com/create', homeUrl: 'https://www.9kd.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_AUTOHOME', name: '汽车之家', kind: 'article', region: 'cn', injectUrl: 'https://chejiahao.autohome.com.cn/article/post.html', homeUrl: 'https://www.autohome.com.cn/', hasBuiltinScript: false },
  { id: 'ARTICLE_JIANPIAN', name: '简篇', kind: 'article', region: 'cn', injectUrl: 'https://www.jianpian.cn/p/edit', homeUrl: 'https://www.jianpian.cn/', hasBuiltinScript: false },
  { id: 'ARTICLE_TONGHUASHUN', name: '同花顺', kind: 'article', region: 'cn', injectUrl: 'https://t.10jqka.com.cn/newcircle/creation/postAll', homeUrl: 'https://t.10jqka.com.cn/', hasBuiltinScript: false },
  { id: 'ARTICLE_DONGCHEDI', name: '懂车帝', kind: 'article', region: 'cn', injectUrl: 'https://mp.dcdapp.com/profile_v2/publish/article', homeUrl: 'https://mp.dcdapp.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_ZSXQ', name: '知识星球', kind: 'article', region: 'cn', injectUrl: 'https://wx.zsxq.com/', homeUrl: 'https://wx.zsxq.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_NETEASE', name: '网易号', kind: 'article', region: 'cn', injectUrl: 'https://mp.163.com/#/article-publish', homeUrl: 'https://mp.163.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_SOHU', name: '搜狐号', kind: 'article', region: 'cn', injectUrl: 'https://mp.sohu.com/mpfe/v4/contentManagement/news/addarticle', homeUrl: 'https://mp.sohu.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_DAYUHAO', name: '大鱼号', kind: 'article', region: 'cn', injectUrl: 'https://mp.dayu.com/dashboard/article/write', homeUrl: 'https://mp.dayu.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_DINGDUANHAO', name: '顶端号', kind: 'article', region: 'cn', injectUrl: 'https://mp.topnews.cn/#/scriptWrite', homeUrl: 'https://mp.topnews.cn/', hasBuiltinScript: false },
  { id: 'ARTICLE_KUAICHUANHAO', name: '快传号', kind: 'article', region: 'cn', injectUrl: 'https://kuaichuan.360kuai.com/#/console/publish/article', homeUrl: 'https://kuaichuan.360kuai.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_YIDIANZIXUN', name: '一点资讯', kind: 'article', region: 'cn', injectUrl: 'https://mp.yidianzixun.com/#/Writing/articleEditor', homeUrl: 'https://mp.yidianzixun.com/', hasBuiltinScript: false },
  { id: 'ARTICLE_XARTICLE', name: 'X Articles', kind: 'article', region: 'intl', injectUrl: 'https://x.com/compose/articles', homeUrl: 'https://x.com/compose/articles', hasBuiltinScript: false },
  { id: 'PODCAST_QQMUSIC', name: 'QQ音乐', kind: 'podcast', region: 'cn', injectUrl: 'https://mp.tencentmusic.com/index', homeUrl: 'https://mp.tencentmusic.com/index', hasBuiltinScript: false },
  { id: 'PODCAST_LIZHI', name: '荔枝', kind: 'podcast', region: 'cn', injectUrl: 'https://nj.lizhi.fm/static/newsite/#/index', homeUrl: 'https://nj.lizhi.fm/static/newsite/#/index', hasBuiltinScript: false },
  { id: 'PODCAST_XIMALAYA', name: '喜马拉雅', kind: 'podcast', region: 'cn', injectUrl: 'https://creator.ximalaya.com/anchor/sound-album/sound/single-upload', homeUrl: 'https://creator.ximalaya.com/', hasBuiltinScript: false },
  { id: 'PODCAST_XIAOYUZHOU', name: '小宇宙', kind: 'podcast', region: 'cn', injectUrl: 'https://podcaster.xiaoyuzhoufm.com/dashboard/episodes/new', homeUrl: 'https://podcaster.xiaoyuzhoufm.com/', hasBuiltinScript: false },
  { id: 'PODCAST_QINGTING', name: '蜻蜓FM', kind: 'podcast', region: 'cn', injectUrl: 'https://studio.qingting.fm/album', homeUrl: 'https://studio.qingting.fm/', hasBuiltinScript: false },
  { id: 'PODCAST_NETEASE', name: '网易云播客', kind: 'podcast', region: 'cn', injectUrl: 'https://podcast.music.163.com/web/podcast/upload', homeUrl: 'https://podcast.music.163.com/', hasBuiltinScript: false },
  { id: 'PODCAST_SPOTIFY', name: 'Spotify', kind: 'podcast', region: 'intl', injectUrl: 'https://creators.spotify.com/pod/show', homeUrl: 'https://creators.spotify.com/', hasBuiltinScript: false },
]

/** @deprecated 使用 MULTIPOST_PLATFORMS.filter(p => p.kind === 'dynamic') */
export const DYNAMIC_PLATFORMS: PublishPlatform[] = MULTIPOST_PLATFORMS.filter(
  (p) => p.kind === 'dynamic',
)

export function platformsByKind(kind: PublishKind): PublishPlatform[] {
  return MULTIPOST_PLATFORMS.filter((p) => p.kind === kind)
}

export type PlatformRunStatus =
  | 'idle'
  | 'queued'
  | 'opening'
  | 'filling'
  | 'done'
  | 'no_script'
  | 'error'

export type PlatformRunState = {
  id: string
  status: PlatformRunStatus
  error?: string
  tabId?: number
}


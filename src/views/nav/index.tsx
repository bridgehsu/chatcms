import { Link } from "react-router-dom";

/** 旧「导航书签」已废弃；插件导航改同源业务地图 */
export const NavBookmarksPage = () => (
  <div className="page page-scroll" style={{ padding: 24 }}>
    <h1 style={{ fontSize: 18, marginBottom: 8 }}>导航管理已合并</h1>
    <p style={{ color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 480 }}>
      原扁平书签（nav_bookmarks）已废弃。请在
      <Link to="/map" style={{ margin: "0 4px" }}>
        业务地图
      </Link>
      维护「常用工具」与分类网站；浏览器扩展「导航」Tab 与此同源。
    </p>
  </div>
);

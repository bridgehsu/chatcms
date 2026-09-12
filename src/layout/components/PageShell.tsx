import type { ReactNode } from "react";
import { Topbar } from "@/layout/components/Topbar";

/** 带贴顶标题栏的页面壳（对齐账号管理 / CabinX 顶部） */
export const PageShell = ({
  children,
  scroll = true,
  className = "",
}: {
  children: ReactNode;
  /** 下方内容是否可滚动（默认 true；会话页为 false） */
  scroll?: boolean;
  className?: string;
}) => (
  <div className={`page-shell${className ? ` ${className}` : ""}`}>
    <Topbar />
    <div className={`page-shell__body${scroll ? " page-shell__body--scroll" : ""}`}>
      {children}
    </div>
  </div>
);

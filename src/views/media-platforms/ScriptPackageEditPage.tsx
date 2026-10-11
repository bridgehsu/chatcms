import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Dropdown, Input, Modal, Select, Switch, message } from "antd";
import type { MenuProps } from "antd";
import { PageShell } from "@/layout/components/PageShell";
import { invoke } from "@/hooks/useTauri";
import { IconCode, IconPlus } from "@/components/icons";
import type { ScriptFile, ScriptPackageDetail } from "@/types";
import { ScriptCodeEditor } from "./components/ScriptCodeEditor";
import {
  SCRIPT_CONTRACT_SUMMARY,
  SCRIPT_TEMPLATES,
  lintPageScript,
  type ScriptTemplateKind,
} from "./pageScriptContract";

type TopbarBusy = "save" | "newfile" | "rename" | "delete" | null;

const emitTopbar = (busy: TopbarBusy, dirty: boolean) => {
  window.dispatchEvent(
    new CustomEvent("script-pkg:topbar-state", {
      detail: { busy, dirty },
    }),
  );
};

export const ScriptPackageEditPage = () => {
  const { packageId = "" } = useParams();
  const [detail, setDetail] = useState<ScriptPackageDetail | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [entryPath, setEntryPath] = useState("main.js");
  const [activePath, setActivePath] = useState("");
  const [draft, setDraft] = useState("");
  const [dirtyFile, setDirtyFile] = useState(false);
  const [busy, setBusy] = useState<TopbarBusy>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(true);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTo, setRenameTo] = useState("");

  const files = detail?.files ?? [];

  const applyDetail = (d: ScriptPackageDetail, preferPath?: string) => {
    setDetail(d);
    setName(d.package.name);
    setCode(d.package.code);
    setNotes(d.package.notes);
    setEnabled(d.package.enabled);
    setEntryPath(d.package.entry_path);
    const nextPath =
      preferPath && d.files.some((f) => f.path === preferPath)
        ? preferPath
        : d.files.some((f) => f.path === activePath)
          ? activePath
          : d.package.entry_path || d.files[0]?.path || "";
    setActivePath(nextPath);
    const f = d.files.find((x) => x.path === nextPath);
    setDraft(f?.draft_content ?? "");
    setDirtyFile(false);
  };

  const load = async (preferPath?: string) => {
    const d = await invoke<ScriptPackageDetail>("script_pkg_get", {
      id: packageId,
    });
    applyDetail(d, preferPath);
  };

  useEffect(() => {
    if (!packageId) return;
    setLoading(true);
    void load()
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId]);

  useEffect(() => {
    emitTopbar(busy, dirtyFile);
  }, [busy, dirtyFile]);

  const insertTemplate = (kind: ScriptTemplateKind) => {
    const tpl = SCRIPT_TEMPLATES[kind].source;
    if (draft.trim()) {
      const ok = window.confirm(
        `用「${SCRIPT_TEMPLATES[kind].label}」覆盖当前编辑内容？`,
      );
      if (!ok) return;
    }
    setDraft(tpl);
    setDirtyFile(true);
    message.success(`已插入${SCRIPT_TEMPLATES[kind].label}`);
  };

  const templateMenu: MenuProps = {
    items: (Object.keys(SCRIPT_TEMPLATES) as ScriptTemplateKind[]).map(
      (kind) => ({
        key: kind,
        label: SCRIPT_TEMPLATES[kind].label,
        onClick: () => insertTemplate(kind),
      }),
    ),
  };

  /** 保存：元数据 + 当前文件写回磁盘目录 */
  const saveAll = async () => {
    if (activePath) {
      const issues = lintPageScript(draft);
      const errors = issues.filter((i) => i.level === "error");
      const warns = issues.filter((i) => i.level === "warn");
      for (const w of warns) message.warning(w.message);
      if (errors.length) {
        setError(errors.map((e) => e.message).join("；"));
        message.error(errors[0].message);
        return;
      }
    }

    setBusy("save");
    setError("");
    setOk("");
    try {
      if (activePath) {
        await invoke<ScriptFile>("script_file_upsert", {
          packageId,
          path: activePath,
          draftContent: draft,
        });
      }
      const d = await invoke<ScriptPackageDetail>("script_pkg_update", {
        id: packageId,
        name: name.trim(),
        code: code.trim(),
        enabled,
        entryPath,
        notes: notes.trim() || null,
      });
      applyDetail(d, activePath);
      setOk("已保存");
      message.success("已保存");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const openInIde = async () => {
    try {
      await invoke<string>("script_pkg_open_editor", { id: packageId });
      message.success("已用 IDE 打开脚本目录");
    } catch (e) {
      message.error(String(e));
    }
  };

  useEffect(() => {
    const onSave = () => void saveAll();
    const onRequest = () => emitTopbar(busy, dirtyFile);
    window.addEventListener("script-pkg:save", onSave);
    window.addEventListener("script-pkg:topbar-request", onRequest);
    return () => {
      window.removeEventListener("script-pkg:save", onSave);
      window.removeEventListener("script-pkg:topbar-request", onRequest);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId, activePath, draft, name, code, enabled, entryPath, notes, dirtyFile, busy]);

  const selectFile = (path: string) => {
    if (path === activePath) return;
    if (dirtyFile) {
      const leave = window.confirm("当前文件有未保存修改，切换将丢弃。继续？");
      if (!leave) return;
    }
    const f = files.find((x) => x.path === path);
    setActivePath(path);
    setDraft(f?.draft_content ?? "");
    setDirtyFile(false);
    setOk("");
    setError("");
  };

  const createFile = async () => {
    const raw = newFileName.trim();
    if (!raw) return;
    const path = raw.toLowerCase().endsWith(".js") ? raw : `${raw}.js`;
    setBusy("newfile");
    setError("");
    try {
      await invoke<ScriptFile>("script_file_upsert", {
        packageId,
        path,
        draftContent:
          "// 辅助文件（同包可被入口引用逻辑时按目录维护）\n" +
          "// 入口须为函数体：见左侧「脚本契约」或插入模板\n",
      });
      setNewFileOpen(false);
      setNewFileName("");
      await load(path);
      setOk(`已创建 ${path}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const renameFile = async () => {
    if (!activePath) return;
    const raw = renameTo.trim();
    if (!raw) return;
    const to = raw.toLowerCase().endsWith(".js") ? raw : `${raw}.js`;
    setBusy("rename");
    setError("");
    try {
      const d = await invoke<ScriptPackageDetail>("script_file_rename", {
        packageId,
        fromPath: activePath,
        toPath: to,
      });
      setRenameOpen(false);
      applyDetail(d, to);
      setOk(`已重命名为 ${to}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const deleteFile = async () => {
    if (!activePath) return;
    if (files.length <= 1) {
      message.warning("至少保留一个文件");
      return;
    }
    if (!window.confirm(`删除文件「${activePath}」？`)) return;
    setBusy("delete");
    setError("");
    try {
      const d = await invoke<ScriptPackageDetail>("script_file_delete", {
        packageId,
        path: activePath,
      });
      applyDetail(d);
      setOk(`已删除`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <PageShell scroll={false}>
        <div className="page script-pkg-page">
          <div className="script-pkg-shell script-pkg-shell--center">
            <p className="model-status-idle">加载中…</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!detail) {
    return (
      <PageShell scroll={false}>
        <div className="page script-pkg-page">
          <div className="script-pkg-shell script-pkg-shell--center">
            <p className="mcp-form-error">{error || "脚本包不存在"}</p>
            <Link className="media-gen-page__back" to="/media-platforms">
              ← 返回插件脚本
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const pkg = detail.package;
  const entryOptions = files.map((f) => ({
    value: f.path,
    label: f.path === pkg.entry_path ? `${f.path}（入口）` : f.path,
  }));
  const statusLine = [code || pkg.code, `${files.length} 个文件`]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageShell scroll={false}>
      <div className="page script-pkg-page">
        <div className="script-pkg-shell">
          <aside className="script-pkg-side" aria-label="脚本设置">
            <header className="script-pkg-side__head">
              <div className="script-pkg-side__heading">
                <h3 className="script-pkg-side__title" title={name || pkg.name}>
                  {name || pkg.name}
                </h3>
                <p className="script-pkg-side__meta">{statusLine}</p>
              </div>
              <label
                className={`script-pkg-side__enable${enabled ? " is-on" : ""}`}
              >
                <Switch
                  size="small"
                  checked={enabled}
                  onChange={setEnabled}
                />
                <span>{enabled ? "启用" : "停用"}</span>
              </label>
            </header>

            <div className="script-pkg-side__scroll">
              <section className="script-pkg-block script-pkg-contract">
                <h4 className="script-pkg-block__label">脚本契约</h4>
                <ul className="script-pkg-contract__list">
                  {SCRIPT_CONTRACT_SUMMARY.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="script-pkg-contract__hint">
                  完整说明见文档「渠道脚本规范」；右侧可插入模板。
                </p>
              </section>

              <section className="script-pkg-block">
                <h4 className="script-pkg-block__label">基本信息</h4>
                <div className="script-pkg-side__fields">
                  <div className="script-pkg-field">
                    <label className="script-pkg-field__label">名称</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="脚本名称"
                    />
                  </div>
                  <div className="script-pkg-field">
                    <label className="script-pkg-field__label">编码</label>
                    <Input
                      value={code}
                      className="script-pkg-field__mono"
                      placeholder="如 JOB_BOSS_GREET"
                      onChange={(e) =>
                        setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                      }
                    />
                  </div>
                  <div className="script-pkg-field">
                    <label className="script-pkg-field__label">入口文件</label>
                    <Select
                      value={entryPath}
                      options={entryOptions}
                      onChange={setEntryPath}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div className="script-pkg-field">
                    <label className="script-pkg-field__label">备注</label>
                    <Input.TextArea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="可选说明"
                      className="script-pkg-field__notes"
                    />
                  </div>
                </div>
              </section>

              {error ? <p className="mcp-form-error">{error}</p> : null}
              {ok ? <p className="mcp-form-ok">{ok}</p> : null}

              <section className="script-pkg-block script-pkg-files">
                <div className="script-pkg-files__head">
                  <h4 className="script-pkg-block__label">文件</h4>
                  <div className="script-pkg-files__actions">
                    <button
                      type="button"
                      className="btn-mcp-action script-pkg-files__btn"
                      disabled={!!busy}
                      onClick={() => {
                        setNewFileName("");
                        setNewFileOpen(true);
                      }}
                    >
                      <IconPlus />
                      <span>新建</span>
                    </button>
                    <button
                      type="button"
                      className="btn-mcp-action script-pkg-files__btn"
                      disabled={!!busy}
                      title="用 IDE（默认 VS Code）打开脚本目录"
                      onClick={() => void openInIde()}
                    >
                      <IconCode />
                      <span>IDE</span>
                    </button>
                  </div>
                </div>
                <ul className="script-pkg-files__list">
                  {files.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={`script-pkg-files__item${
                          f.path === activePath ? " is-active" : ""
                        }`}
                        onClick={() => selectFile(f.path)}
                      >
                        <span className="script-pkg-files__name">{f.path}</span>
                        {f.path === pkg.entry_path ? (
                          <span className="script-pkg-files__badge">入口</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>

          <section className="script-pkg-editor" aria-label="脚本编辑">
            <div className="script-pkg-editor__bar">
              <div className="script-pkg-editor__title">
                <span className="script-pkg-editor__eyebrow">正在编辑</span>
                <span className="script-pkg-editor__path">
                  {activePath || "未选择文件"}
                </span>
                {dirtyFile ? (
                  <span className="script-pkg-editor__dirty">未保存</span>
                ) : null}
              </div>
              <div className="script-pkg-editor__actions">
                <Dropdown
                  menu={templateMenu}
                  trigger={["click"]}
                  disabled={!activePath || !!busy}
                >
                  <button
                    type="button"
                    className="btn-mcp-action script-pkg-files__btn"
                    disabled={!activePath || !!busy}
                  >
                    插入模板
                  </button>
                </Dropdown>
                <button
                  type="button"
                  className="btn-mcp-action script-pkg-files__btn"
                  disabled={!activePath || !!busy}
                  onClick={() => {
                    setRenameTo(activePath.replace(/\.js$/i, ""));
                    setRenameOpen(true);
                  }}
                >
                  重命名
                </button>
                <button
                  type="button"
                  className="btn-mcp-remove script-pkg-files__btn"
                  disabled={!activePath || !!busy}
                  onClick={() => void deleteFile()}
                >
                  删除
                </button>
              </div>
            </div>
            {activePath ? (
              <ScriptCodeEditor
                fileKey={`${packageId}:${activePath}`}
                value={draft}
                onChange={(next) => {
                  setDraft(next);
                  setDirtyFile(true);
                }}
              />
            ) : (
              <div className="script-pkg-editor__empty">
                <p className="script-pkg-editor__empty-title">选择或新建一个文件</p>
                <p className="script-pkg-editor__empty-desc">
                  左侧管理信息与文件；右侧编辑，也可用 IDE 打开目录
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal
        title="新建文件"
        open={newFileOpen}
        onCancel={() => setNewFileOpen(false)}
        onOk={() => void createFile()}
        confirmLoading={busy === "newfile"}
        okText="创建"
        destroyOnClose
      >
        <Input
          autoFocus
          placeholder="如 helpers.js"
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          onPressEnter={() => void createFile()}
        />
      </Modal>

      <Modal
        title="重命名文件"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={() => void renameFile()}
        confirmLoading={busy === "rename"}
        okText="重命名"
        destroyOnClose
      >
        <Input
          autoFocus
          value={renameTo}
          onChange={(e) => setRenameTo(e.target.value)}
          onPressEnter={() => void renameFile()}
          addonAfter=".js"
        />
      </Modal>
    </PageShell>
  );
};

export default ScriptPackageEditPage;

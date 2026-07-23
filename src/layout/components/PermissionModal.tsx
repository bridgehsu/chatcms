import { useChatStore } from "@/stores/useChatStore";

export const PermissionModal = () => {
  const { pendingPermission, respondPermission } = useChatStore();

  if (!pendingPermission) return null;

  const { request_id, tool_name, input } = pendingPermission;
  const allow = () => void respondPermission(request_id, true);
  const deny = () => void respondPermission(request_id, false);

  return (
    <div className="modal-backdrop">
      <div className="modal permission-modal">
        <h2 className="modal-title">需要授权</h2>
        <p className="permission-desc">
          Agent 请求执行工具 <strong>{tool_name}</strong>：
        </p>
        <pre className="permission-input">{JSON.stringify(input, null, 2)}</pre>
        <div className="modal-actions">
          <button className="btn-deny" onClick={deny} type="button">
            拒绝
          </button>
          <button className="btn-allow" onClick={allow} type="button">
            允许
          </button>
        </div>
      </div>
    </div>
  );
};

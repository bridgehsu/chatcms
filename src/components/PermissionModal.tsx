import { useChatStore } from "../store/chat";

export function PermissionModal() {
  const { pendingPermission, respondPermission } = useChatStore();

  if (!pendingPermission) return null;

  const { request_id, tool_name, input } = pendingPermission;

  const allow = () => respondPermission(request_id, true);
  const deny = () => respondPermission(request_id, false);

  return (
    <div className="modal-backdrop">
      <div className="modal permission-modal">
        <h2 className="modal-title">Permission Required</h2>
        <p className="permission-desc">
          The agent wants to run <strong>{tool_name}</strong>:
        </p>
        <pre className="permission-input">{JSON.stringify(input, null, 2)}</pre>
        <div className="modal-actions">
          <button className="btn-deny" onClick={deny}>
            Deny
          </button>
          <button className="btn-allow" onClick={allow}>
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

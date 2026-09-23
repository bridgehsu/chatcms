import { useChatStore } from "@/stores/useChatStore";
import { AgentPicker } from "./AgentPicker";

/** 左侧会话栏顶部：选择本会话 / 新会话的主 Agent */
export const SessionAgentBar = () => {
  const {
    activeSessionId,
    activeSession,
    preferredAgentId,
    isStreaming,
    pendingPermission,
    setPreferredAgentId,
    setSessionAgent,
  } = useChatStore();

  const sessionBound = Boolean(activeSession?.agent_id);
  const value = activeSession?.agent_id ?? preferredAgentId;
  const disabled = isStreaming || !!pendingPermission;

  const onChange = (id: string | null) => {
    if (id == null) {
      setPreferredAgentId(null);
      return;
    }
    if (activeSessionId && activeSessionId !== "pending") {
      void setSessionAgent(id);
    } else {
      setPreferredAgentId(id);
    }
  };

  return (
    <div className="session-agent-bar">
      <AgentPicker
        value={value}
        onChange={onChange}
        disabled={disabled}
        allowAuto={!sessionBound}
        placement="bottom"
        variant="sidebar"
      />
    </div>
  );
};

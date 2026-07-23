import { ChatWindow } from "./components/ChatWindow";
import { SessionList } from "./components/SessionList";

/** 智能会话页：会话列表 + 对话区 */
export const ChatPage = () => (
  <div className="chat-page">
    <SessionList />
    <ChatWindow />
  </div>
);

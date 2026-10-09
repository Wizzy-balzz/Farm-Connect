import { useContext } from "react";
import { NotificationContext } from "../context/NotificationContext.jsx";
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}
export default useNotifications;

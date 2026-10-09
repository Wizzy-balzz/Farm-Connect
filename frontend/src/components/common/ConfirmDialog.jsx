import { memo } from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "./Button.jsx";
import { AlertTriangle } from "../icons/Icons.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";

function ConfirmDialogBase({ open, title, body, onConfirm, onCancel }) {
  const { t } = useLanguage();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={420}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>{t("cancel")}</Button>
          <Button variant="danger" onClick={onConfirm}>{t("confirm")}</Button>
        </>
      }
    >
      <div className="fc-flex-gap-12" style={{ alignItems: "flex-start" }}>
        <div className="fc-stat-icon" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
          <AlertTriangle size={20} />
        </div>
        <p className="fc-muted" style={{ margin: 0 }}>{body}</p>
      </div>
    </Modal>
  );
}

export const ConfirmDialog = memo(ConfirmDialogBase);
export default ConfirmDialog;

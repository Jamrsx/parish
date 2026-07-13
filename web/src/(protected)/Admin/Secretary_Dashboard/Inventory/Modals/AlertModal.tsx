import React from "react";
import { Check, X } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  type: "success" | "error";
  title?: string;
  message: string;
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  type,
  title,
  message,
  onClose,
}) => {
  if (!isOpen) return null;

  const styles =
    type === "success"
      ? {
          bg: "bg-green-100",
          iconBg: "bg-green-500",
          button: "bg-green-600 hover:bg-green-700",
          icon: <Check size={32} />,
          defaultTitle: "Success",
        }
      : {
          bg: "bg-red-100",
          iconBg: "bg-red-500",
          button: "bg-red-600 hover:bg-red-700",
          icon: <X size={32} />,
          defaultTitle: "Error",
        };

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className={`${styles.bg} p-6 flex flex-col items-center`}>
          <div
            className={`w-16 h-16 rounded-full ${styles.iconBg} text-white flex items-center justify-center text-3xl font-bold`}
          >
            {styles.icon}
          </div>

          <h2 className="mt-4 text-xl font-semibold text-gray-800">
            {title || styles.defaultTitle}
          </h2>

          <p className="text-gray-600 text-center mt-2">{message}</p>
        </div>

        <div className="p-5 flex justify-center">
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg text-white transition ${styles.button}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
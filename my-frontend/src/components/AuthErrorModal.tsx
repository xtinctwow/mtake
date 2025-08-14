import { useEffect, useRef } from "react";

export default function AuthErrorModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] animate-fade-in">
      <div
        ref={modalRef}
        className="bg-gray-900 rounded-lg p-6 w-full max-w-md text-white relative shadow-xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {/* Title */}
        <div className="mb-4 border-b border-gray-700 pb-3">
          <h3 className="text-lg font-semibold">Login Notice</h3>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-200">
          {message?.trim() || "An unknown error occurred. Please try again."}
        </p>
      </div>
    </div>
  );
}

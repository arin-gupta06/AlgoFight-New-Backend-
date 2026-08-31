import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./NotificationContext.css";

const NotificationContext = createContext(null);

const DEFAULT_DURATION = 4200;
const MAX_VISIBLE_NOTIFICATIONS = 4;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timeoutMapRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timeoutId = timeoutMapRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(id);
    }

    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    ({ title = "Notice", message = "", type = "info", duration = DEFAULT_DURATION }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = {
        id,
        title,
        message,
        type,
      };

      // Safely schedule state update to prevent "Cannot update a component while rendering a different component"
      setTimeout(() => {
        setNotifications((prev) => [...prev, next].slice(-MAX_VISIBLE_NOTIFICATIONS));
      }, 0);

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => {
          dismiss(id);
        }, duration);
        timeoutMapRef.current.set(id, timeoutId);
      }

      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      timeoutMapRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutMapRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <div className="app-notification-root" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {notifications.map((item) => (
            <motion.article
              key={item.id}
              layout
              initial={{ opacity: 0, x: 24, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, y: -10, scale: 0.96 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`app-notification-card app-notification-${item.type}`}
              role="status"
            >
              <span className="app-notification-accent" />

              <div className="app-notification-body">
                <h4>{item.title}</h4>
                {item.message ? <p>{item.message}</p> : null}
              </div>

              <button
                type="button"
                className="app-notification-close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
              >
                x
              </button>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used inside NotificationProvider");
  }
  return context;
}

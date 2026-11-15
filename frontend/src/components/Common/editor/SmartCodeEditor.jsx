import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles, faTriangleExclamation, faInfoCircle, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { handleEditorKeyDown } from "../../../utils/editorSmartTyping";
import { formatCode } from "../../../utils/codeFormatter";
import { EditorHistory } from "../../../utils/editorHistory";
import { highlightCode } from "../../../utils/codeHighlighter";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal";

export const SmartCodeEditor = forwardRef(({
  value = "",
  onChange,
  language = "javascript",
  disabled = false,
  isBlurred = false,
  errorLocation = null, // { line: number, column?: number, message?: string }
  className = "livebattle-code-editor",
  style = {},
  showToast = true,
  enableAutoFormat = true,
  onFormatResult,
  onKeyDown,
  onRun,
  onSubmit,
  problemId = null,
  textareaRef: externalTextareaRef,
}, forwardedRef) => {
  const localRef = useRef(null);
  const textareaRef = externalTextareaRef || localRef;
  const highlightRef = useRef(null);
  const gutterRef = useRef(null);

  const [toast, setToast] = useState(null);
  const [flashClass, setFlashClass] = useState("");
  const [isFormatting, setIsFormatting] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const toastTimeoutRef = useRef(null);
  const historyRef = useRef(new EditorHistory());
  const lastJumpedErrorRef = useRef(null);

  // Generate array of lines for gutter numbering
  const lines = useMemo(() => {
    return (value || "").split("\n");
  }, [value]);

  // Syntax highlight code into rich semantic tokens
  const highlightedHtml = useMemo(() => {
    const html = highlightCode(value || "", language);
    return value.endsWith("\n") ? html + "\n " : html;
  }, [value, language]);

  // Sync scroll position between textarea, highlight layer, and gutter
  const handleScroll = useCallback((e) => {
    const target = e.target;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  // Sync scroll after value / selection updates
  useEffect(() => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (highlightRef.current) {
        highlightRef.current.scrollTop = scrollTop;
        highlightRef.current.scrollLeft = scrollLeft;
      }
      if (gutterRef.current) {
        gutterRef.current.scrollTop = scrollTop;
      }
    }
  }, [value, textareaRef]);

  // Initialize or re-scope history when problemId changes
  useEffect(() => {
    historyRef.current.init(value, 0, 0);
    setCanUndo(false);
    setCanRedo(false);
  }, [problemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump cursor & scroll to line and column (Only executed once on initial error discovery)
  const jumpToLine = useCallback((targetLine, targetCol = 1) => {
    if (!targetLine || !textareaRef.current) return;
    const currentVal = textareaRef.current.value || "";
    const lineList = currentVal.split("\n");
    if (targetLine < 1 || targetLine > lineList.length) return;

    let charOffset = 0;
    for (let i = 0; i < targetLine - 1; i++) {
      charOffset += lineList[i].length + 1; // +1 for newline
    }

    const col = Math.max(0, (targetCol || 1) - 1);
    const lineLen = lineList[targetLine - 1].length;
    const finalPos = charOffset + Math.min(col, lineLen);

    const textarea = textareaRef.current;
    textarea.focus();
    // Position caret cleanly without locking user out of other lines
    textarea.setSelectionRange(finalPos, finalPos);

    const lineHeight = 22; // exact monospace line height
    const newScrollTop = Math.max(0, (targetLine - 3) * lineHeight);
    textarea.scrollTop = newScrollTop;
    if (highlightRef.current) highlightRef.current.scrollTop = newScrollTop;
    if (gutterRef.current) gutterRef.current.scrollTop = newScrollTop;
  }, [textareaRef]);

  // Jump cursor & scroll to error line ONLY ONCE when a new error appears (never hijack typing keystrokes)
  useEffect(() => {
    if (!errorLocation || !errorLocation.line) {
      lastJumpedErrorRef.current = null;
      return;
    }

    const isSameError =
      lastJumpedErrorRef.current &&
      lastJumpedErrorRef.current.line === errorLocation.line &&
      lastJumpedErrorRef.current.column === errorLocation.column &&
      lastJumpedErrorRef.current.message === errorLocation.message;

    if (!isSameError) {
      lastJumpedErrorRef.current = {
        line: errorLocation.line,
        column: errorLocation.column,
        message: errorLocation.message,
      };
      jumpToLine(errorLocation.line, errorLocation.column || 1);
    }
  }, [errorLocation, jumpToLine]);

  const showToastFeedback = useCallback((message, type = "info") => {
    if (!showToast) return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  }, [showToast]);

  const triggerFlash = useCallback((type) => {
    setFlashClass(`flash-${type}`);
    setTimeout(() => {
      setFlashClass("");
    }, 600);
  }, []);

  // Primary formatting function
  const executeFormat = useCallback(async (isManual = false) => {
    if (!value || disabled) return;

    try {
      if (isManual) setIsFormatting(true);

      const textarea = textareaRef.current;
      const prevStart = textarea ? textarea.selectionStart : 0;
      const prevEnd = textarea ? textarea.selectionEnd : 0;

      // Commit pre-format state to history so Ctrl+Z undoes format immediately
      historyRef.current.recordTyping(value, prevStart, prevEnd, true);

      const res = await formatCode(value, language);

      if (res.success) {
        if (res.changed) {
          let lineNum = 1;
          let colNum = 0;

          if (textarea && prevStart !== undefined) {
            const before = value.slice(0, prevStart).split("\n");
            lineNum = before.length;
            colNum = before[before.length - 1].length;
          }

          onChange(res.formatted);

          const newLines = res.formatted.split("\n");
          let newPos = 0;
          for (let i = 0; i < Math.min(lineNum - 1, newLines.length); i++) {
            newPos += newLines[i].length + 1;
          }
          if (lineNum <= newLines.length) {
            newPos += Math.min(colNum, newLines[lineNum - 1].length);
          }
          newPos = Math.min(newPos, res.formatted.length);

          // Push formatted state to history
          historyRef.current.recordTyping(res.formatted, newPos, newPos, true);
          setCanUndo(historyRef.current.canUndo());
          setCanRedo(historyRef.current.canRedo());

          if (textarea && prevStart !== undefined) {
            requestAnimationFrame(() => {
              if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
              }
            });
          }

          if (isManual) {
            showToastFeedback(
              res.isPrettier ? "Formatted with Prettier ✨" : "Code formatted ✨",
              "success"
            );
            triggerFlash("success");
          }
        } else if (isManual) {
          showToastFeedback("Code is already formatted ✓", "info");
          triggerFlash("info");
        }
      } else if (isManual) {
        showToastFeedback(res.error || "Prettier: Syntax error", "error");
        triggerFlash("error");
      }

      onFormatResult?.(res);
      return res;
    } catch (err) {
      if (isManual) {
        showToastFeedback(err?.message || "Formatting failed", "error");
        triggerFlash("error");
      }
    } finally {
      if (isManual) setIsFormatting(false);
    }
  }, [value, language, disabled, onChange, textareaRef, showToastFeedback, triggerFlash, onFormatResult]);

  // Undo implementation
  const triggerUndo = useCallback(() => {
    if (disabled) return;
    const textarea = textareaRef.current;
    const curStart = textarea ? textarea.selectionStart : 0;
    const curEnd = textarea ? textarea.selectionEnd : 0;

    const prevState = historyRef.current.undo(value, curStart, curEnd);
    if (prevState) {
      onChange(prevState.code);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = prevState.selectionStart;
          textareaRef.current.selectionEnd = prevState.selectionEnd;
        }
      });
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }, [value, disabled, onChange, textareaRef]);

  // Redo implementation
  const triggerRedo = useCallback(() => {
    if (disabled) return;
    const textarea = textareaRef.current;
    const curStart = textarea ? textarea.selectionStart : 0;
    const curEnd = textarea ? textarea.selectionEnd : 0;

    const nextState = historyRef.current.redo(value, curStart, curEnd);
    if (nextState) {
      onChange(nextState.code);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = nextState.selectionStart;
          textareaRef.current.selectionEnd = nextState.selectionEnd;
        }
      });
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }, [value, disabled, onChange, textareaRef]);

  // Expose imperative handle for external buttons/toolbars
  useImperativeHandle(forwardedRef, () => ({
    formatCode: () => executeFormat(true),
    undo: triggerUndo,
    redo: triggerRedo,
    canUndo: () => historyRef.current.canUndo(),
    canRedo: () => historyRef.current.canRedo(),
    openShortcuts: () => setIsShortcutsOpen(true),
    closeShortcuts: () => setIsShortcutsOpen(false),
    focus: () => textareaRef.current?.focus(),
    getTextarea: () => textareaRef.current,
    jumpToLine,
    isFormatting,
  }), [executeFormat, triggerUndo, triggerRedo, isFormatting, textareaRef, jumpToLine]);

  // Background Idle Self-Alignment via Prettier (zero user intervention)
  useEffect(() => {
    const isPy = ["python", "py", "python3"].includes((language || "").toLowerCase());
    if (isPy || !enableAutoFormat || !value || disabled) return;

    const timer = setTimeout(() => {
      executeFormat(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [value, language, disabled, enableAutoFormat, executeFormat]);

  // Clean up toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleKeyDown = (e) => {
    const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    // 1. UNDO: Ctrl+Z or Cmd+Z (without Shift)
    if (modKey && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      triggerUndo();
      return;
    }

    // 2. REDO: Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z
    if (
      (modKey && (e.key === "y" || e.key === "Y")) ||
      (modKey && e.shiftKey && (e.key === "z" || e.key === "Z"))
    ) {
      e.preventDefault();
      e.stopPropagation();
      triggerRedo();
      return;
    }

    // 3. KEYBOARD SHORTCUTS HELP: F1 or (Ctrl/Cmd + Alt + H)
    if (e.key === "F1" || (modKey && e.altKey && (e.key === "h" || e.key === "H"))) {
      e.preventDefault();
      e.stopPropagation();
      setIsShortcutsOpen((prev) => !prev);
      return;
    }

    // 4. RUN TESTS: Ctrl+Enter or Cmd+Enter (without Shift)
    if (modKey && !e.shiftKey && e.key === "Enter" && onRun) {
      e.preventDefault();
      e.stopPropagation();
      onRun();
      return;
    }

    // 5. SUBMIT CODE: Ctrl+Shift+Enter or Cmd+Shift+Enter
    if (modKey && e.shiftKey && e.key === "Enter" && onSubmit) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit();
      return;
    }

    // 6. FORMAT SHORTCUTS: Shift+Alt+F, Ctrl+Alt+F, Ctrl+Shift+I, Ctrl+S
    const isFormatKey =
      (e.shiftKey && e.altKey && (e.key === "F" || e.key === "f")) ||
      (modKey && e.altKey && (e.key === "F" || e.key === "f")) ||
      (modKey && e.shiftKey && (e.key === "I" || e.key === "i"));

    const isSaveKey = modKey && (e.key === "s" || e.key === "S");

    if (isFormatKey || isSaveKey) {
      e.preventDefault();
      e.stopPropagation();
      executeFormat(true);
      return;
    }

    // 7. DELEGATE SMART TYPING & LINE OPERATIONS
    handleEditorKeyDown(e, value, onChange, language, historyRef.current);
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
    onKeyDown?.(e);
  };

  const handleChange = (e) => {
    const newVal = e.target.value;
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;

    // Record typing into debounced history
    historyRef.current.recordTyping(newVal, start, end, false);
    onChange(newVal);
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  };

  const handlePaste = (e) => {
    const pastedText = e.clipboardData?.getData("text");
    if (!pastedText) return;

    // Normalize Windows CRLF to Unix LF on paste
    const clean = pastedText.replace(/\r\n/g, "\n");
    const textarea = textareaRef.current;
    if (!textarea) return;

    e.preventDefault();
    const { selectionStart, selectionEnd } = textarea;

    // Save previous state to history
    historyRef.current.recordTyping(value, selectionStart, selectionEnd, true);

    const newCode = value.substring(0, selectionStart) + clean + value.substring(selectionEnd);
    onChange(newCode);

    const newPos = selectionStart + clean.length;
    // Push pasted state to history
    historyRef.current.recordTyping(newCode, newPos, newPos, true);

    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newPos;
      }
    }, 0);
  };

  // 🛡️ ANTI-CHEAT: Prohibit mouse right-clicking, middle-click paste, and drag & drop text
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showToastFeedback("Mouse right-click is disabled in the editor 🛡️", "warning");
    triggerFlash("warning");
  };

  const handleAuxClick = (e) => {
    if (e.button === 1) { // Middle click paste
      e.preventDefault();
      e.stopPropagation();
      showToastFeedback("Mouse middle-click paste is disabled 🛡️", "warning");
      triggerFlash("warning");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showToastFeedback("Drag & drop code insertion is disabled 🛡️", "warning");
    triggerFlash("warning");
  };

  return (
    <div
      className={`smart-editor-container ${className || ""} ${flashClass}`}
      style={{
        filter: isBlurred ? "blur(8px)" : "none",
        transition: "filter 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
        ...style,
      }}
    >
      {/* Line Number Gutter */}
      <div className="smart-editor-gutter" ref={gutterRef} aria-hidden="true">
        <div className="gutter-inner">
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isErrorLine = errorLocation?.line === lineNum;
            return (
              <div
                key={lineNum}
                className={`gutter-line-number ${isErrorLine ? "has-error" : ""}`}
              >
                {lineNum}
              </div>
            );
          })}
        </div>
      </div>

      {/* Code Canvas Area */}
      <div className="smart-editor-canvas">
        {/* Colorful syntax highlighted layer underneath */}
        <pre
          ref={highlightRef}
          className="smart-editor-highlight-layer"
          aria-hidden="true"
        >
          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </pre>

        {/* Interactive editing layer */}
        <textarea
          ref={textareaRef}
          className="smart-editor-input-layer"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onPaste={handlePaste}
          onContextMenu={handleContextMenu}
          onAuxClick={handleAuxClick}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          disabled={disabled}
        />
      </div>

      {errorLocation && errorLocation.line && (
        <div className="editor-error-banner" style={{
          position: "absolute",
          top: "12px",
          right: "16px",
          background: "rgba(255, 42, 122, 0.94)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          boxShadow: "0 0 16px rgba(255, 42, 122, 0.45)",
          color: "#ffffff",
          padding: "6px 14px",
          borderRadius: "8px",
          fontSize: "0.78rem",
          fontWeight: "700",
          fontFamily: "'Space Grotesk', sans-serif",
          zIndex: 15,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <span>Line {errorLocation.line}{errorLocation.column ? `:${errorLocation.column}` : ""}: {errorLocation.message || "Error detected"}</span>
        </div>
      )}

      {toast && (
        <div className={`editor-prettier-toast ${toast.type}`}>
          <FontAwesomeIcon
            icon={
              toast.type === "success"
                ? faWandMagicSparkles
                : toast.type === "warning"
                  ? faShieldHalved
                  : toast.type === "error"
                    ? faTriangleExclamation
                    : faInfoCircle
            }
            className="prettier-toast-icon"
          />
          <span className="prettier-toast-text">{toast.message}</span>
        </div>
      )}

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
});

SmartCodeEditor.displayName = "SmartCodeEditor";

export default SmartCodeEditor;

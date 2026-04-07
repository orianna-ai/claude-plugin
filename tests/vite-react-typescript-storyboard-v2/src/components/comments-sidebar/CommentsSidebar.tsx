import { useCallback, useState } from "react";

import { CheckIcon } from "../../icons";

import "./CommentsSidebar.css";

function CommentsSidebar() {
  const [linkCopied, setLinkCopied] = useState(false);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  }, []);

  return (
    <div className="comments-sidebar-floating-container">
      <div className="comments-sidebar-share-floating">
        <button
          className={`comments-sidebar-share${linkCopied ? " copied" : ""}`}
          onClick={handleShare}
        >
          {linkCopied ? (
            <>
              <CheckIcon size={16} strokeWidth={3} color="#627532" />
              Copied link
            </>
          ) : (
            "Share"
          )}
        </button>
      </div>
    </div>
  );
}

export default CommentsSidebar;

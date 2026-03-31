import { useCallback, useEffect, useRef, useState } from "react";

import { LogOutIcon } from "../icons.tsx";

import "./UserIdentity.css";

interface Identity {
  name: string;
  email: string;
  picture?: string;
}

function useIdentity(): Identity {
  return {
    name: "Local User",
    email: "localhost@orianna.ai",
    picture:
      "https://drive.orianna.ai/acfc8e0231f0490cd11f5f0858faeaaa.jpg",
  };
}

export function UserIdentity() {
  const identity = useIdentity();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMenuOpen(false);
      setIsClosing(false);
    }, 150);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen, closeMenu]);

  if (!identity) {
    return null;
  }

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="user-identity" ref={menuRef}>
      <div
        className={`user-identity-avatar${isMenuOpen || isClosing ? " active" : ""}`}
        onClick={() => {
          if (isMenuOpen && !isClosing) {
            closeMenu();
          } else if (!isMenuOpen && !isClosing) {
            setIsMenuOpen(true);
          }
        }}
      >
        {identity.picture ? (
          <img
            src={identity.picture}
            alt={identity.name}
            className="user-identity-picture"
          />
        ) : (
          <div className="user-identity-initials">
            {getInitials(identity.name)}
          </div>
        )}
      </div>

      {isMenuOpen && (
        <div className={`user-identity-menu${isClosing ? " closing" : ""}`}>
          <div className="user-identity-menu-header">
            <div className="user-identity-menu-name">{identity.name}</div>
            <div className="user-identity-menu-email">{identity.email}</div>
          </div>
          <button
            className="user-identity-logout-button"
            onClick={() => window.location.reload()}
          >
            <LogOutIcon className="user-identity-logout-icon" size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

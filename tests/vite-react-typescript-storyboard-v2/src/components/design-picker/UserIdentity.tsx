import { useCallback, useEffect, useRef, useState } from "react";

import { CreditCardIcon } from "../../icons";
import { LogOutIcon } from "../../icons";
import { useIdentity } from "../../identity";

import "./UserIdentity.css";

const SUPPORT_EMAIL = "hello@softlight.com";

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

  const handleManageBilling = useCallback(() => {
    const homeUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/`
        : "https://app.softlight.com/";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/api/billing/customer-portal?return_url=${encodeURIComponent(homeUrl)}`;
    form.target = "_blank";

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }, []);

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

  const handleLogout = async () => {
    await fetch("/cdn-cgi/access/logout", {
      credentials: "include",
      redirect: "manual",
    });

    window.location.href = "https://app-public.softlight.com?auto_login=false";
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
            <div className="user-identity-menu-email">{identity.email}</div>
          </div>

          <div className="user-identity-menu-actions">
            <button
              type="button"
              onClick={handleManageBilling}
              className="user-identity-menu-item"
            >
              <CreditCardIcon
                size={16}
                className="user-identity-menu-item-icon"
              />
              Manage subscription
            </button>

            <button className="user-identity-menu-item" onClick={handleLogout}>
              <LogOutIcon size={16} className="user-identity-menu-item-icon" />
              Log out
            </button>
          </div>

          <div className="user-identity-menu-footer">
            <span className="user-identity-support-label">Support at</span>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="user-identity-support-link"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

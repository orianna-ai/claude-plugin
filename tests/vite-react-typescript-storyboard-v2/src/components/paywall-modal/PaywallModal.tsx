import { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

import { CheckIcon } from "../../icons";
import { GiftIcon } from "../../icons";

import "./PaywallModal.css";

export interface Paywall {
  recommended_upgrades: Array<{
    upgrade_price: {
      amount?: number;
      currency?: string;
    };
  }>;
}

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  paywallData?: Paywall | null;
}

function PaywallModal({
  isOpen,
  onClose,
  onUpgrade,
  paywallData,
}: PaywallModalProps) {
  const { priceLabel } = useMemo(() => {
    if (!paywallData || paywallData.recommended_upgrades.length === 0) {
      return { priceLabel: "$40" };
    }

    const upgrade = paywallData.recommended_upgrades[0];
    const amount = upgrade.upgrade_price.amount ?? 4000;
    const currency = upgrade.upgrade_price.currency ?? "usd";

    const formattedPrice = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100);

    return {
      priceLabel: formattedPrice,
    };
  }, [paywallData]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="paywall-modal-backdrop" onClick={handleBackdropClick}>
      <div className="paywall-modal-content">
        <div className="paywall-modal-header">
          <h2 className="paywall-modal-title">Upgrade for more iterations</h2>
          <p className="paywall-modal-subtitle">
            You've used this month's free iterations. Upgrade for unlimited
            iterations.
          </p>
        </div>

        <div className="paywall-modal-card">
          <div className="paywall-modal-card-header">
            <span className="paywall-modal-plan-name">Early Access</span>
          </div>

          <ul className="paywall-modal-features">
            <li className="paywall-modal-feature">
              <CheckIcon size={16} className="paywall-modal-feature-icon" />
              <span>
                <span className="paywall-modal-strikethrough">100</span>{" "}
                Unlimited iterations
              </span>
              <span className="paywall-modal-badge">
                <GiftIcon size={12} strokeWidth={2.5} />
                Special
              </span>
            </li>
            <li className="paywall-modal-feature">
              <CheckIcon size={16} className="paywall-modal-feature-icon" />
              <span>Discounted pricing</span>
            </li>
            <li className="paywall-modal-feature">
              <CheckIcon size={16} className="paywall-modal-feature-icon" />
              <span>Unlimited sharing and projects</span>
            </li>
            <li className="paywall-modal-feature">
              <CheckIcon size={16} className="paywall-modal-feature-icon" />
              <span>Cancel anytime</span>
            </li>
          </ul>

          <button
            type="button"
            className="paywall-modal-cta"
            onClick={onUpgrade}
          >
            Upgrade for {priceLabel} / mo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default PaywallModal;

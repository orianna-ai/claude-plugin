import type { ErrorAgentResponse } from "../../../api/types.gen";

import "./ErrorMessage.css";

type Props = {
  error: ErrorAgentResponse;
};

function ErrorMessage({ error }: Props) {
  return (
    <div className="error-message">
      <div className="error-message-bubble">
        <p className="error-message-summary">
          {error.summary}
        </p>
      </div>
    </div>
  );
}

export default ErrorMessage;

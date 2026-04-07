import "./AssistantMessage.css";

type Props = {
  message: string;
};

function AssistantMessage({ message }: Props) {
  return <span className="assistant-message">{message}</span>;
}

export default AssistantMessage;

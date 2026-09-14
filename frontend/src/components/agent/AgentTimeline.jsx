import Card from "../ui/Card";
import AgentTimelineEvent from "./AgentTimelineEvent";
import { getMainTimelineEvents } from "../../utils/agentTimeline";

export default function AgentTimeline({ events, loading }) {
  const mainEvents = getMainTimelineEvents(events);

  return (
    <Card className="agent-timeline-card">
      <h3>Agent timeline</h3>
      {mainEvents.length === 0 ? (
        <p className="agent-empty-note">
          {loading ? "Waiting for the first agent event…" : "No agent activity yet. Start the resolution to begin."}
        </p>
      ) : (
        <ul className="agent-timeline">
          {mainEvents.map((event) => (
            <AgentTimelineEvent event={event} key={event.id} />
          ))}
        </ul>
      )}
    </Card>
  );
}

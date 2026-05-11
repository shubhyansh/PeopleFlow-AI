import { useAuth } from '../../auth/AuthContext';
import { TaskFlowchartView } from '../../components/flowchart/TaskFlowchartView';

export default function Flowchart() {
  const { flowdeskUser } = useAuth();
  if (!flowdeskUser) return null;
  return (
    <TaskFlowchartView
      assigneeId={flowdeskUser.id}
      assigneeName={flowdeskUser.name}
      mode="employee"
    />
  );
}

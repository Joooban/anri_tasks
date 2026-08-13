import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_BADGE } from "@/lib/constants";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={TASK_STATUS_BADGE[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

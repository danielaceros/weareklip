import { NotificationTemplates, type EventKey } from "./notification-templates";
import { notifyPush } from "./notify";

export async function sendEventPush(
  uid: string,
  kind: EventKey,
  data: Record<string, unknown> = {}          
) {
  const [title, body] = NotificationTemplates[kind] ?? [kind, ""];
  const sdata: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) sdata[k] = String(v); 
  }
  sdata.kind = kind;
  return notifyPush(uid, title, body, sdata);
}


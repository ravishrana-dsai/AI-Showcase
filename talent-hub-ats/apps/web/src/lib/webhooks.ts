/**
 * Webhook delivery.
 * Use enqueueWebhooks() for async delivery with retries (requires Redis).
 * Falls back to fireWebhooks() directly if Redis is not configured.
 */
import { createHmac } from "crypto";
import { prisma } from "@talent-hub/db";

export type WebhookEvent =
  | "application.stage_changed"
  | "application.created"
  | "interview.scheduled"
  | "offer.created"
  | "offer.sent"
  | "offer.accepted"
  | "offer.declined";

/**
 * Fire webhooks for an event. Loads org webhooks subscribed to the event,
 * POSTs payload (with X-Webhook-Signature), and logs delivery.
 */
export async function fireWebhooks(
  organizationId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { organizationId, isActive: true },
  });

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  for (const webhook of webhooks) {
    let events: string[] = [];
    try {
      events = JSON.parse(webhook.events || "[]");
    } catch {
      continue;
    }
    if (!events.includes(event)) continue;

    const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": event,
        },
        body,
      });

      // Store only metadata, not the full payload, to avoid retaining PII in delivery logs.
      const deliveryMeta = JSON.stringify({ event, timestamp: new Date().toISOString() });
      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: deliveryMeta,
          statusCode: res.status,
          response: res.ok ? "OK" : `HTTP ${res.status}`,
          success: res.ok,
        },
      });

      if (res.ok) {
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date() },
        });
      }
    } catch (err) {
      const deliveryMeta = JSON.stringify({ event, timestamp: new Date().toISOString() });
      await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: deliveryMeta,
          success: false,
          response: err instanceof Error ? err.message.slice(0, 200) : "Request failed",
        },
      });
    }
  }
}
/**
 * Queue webhook delivery.
 * BullMQ removed — fires directly.
 */
export async function enqueueWebhooks(
  organizationId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  await fireWebhooks(organizationId, event, payload);
}


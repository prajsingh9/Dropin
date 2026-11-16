"use client";

import { useCallback, useState } from "react";
import type { DeviceCommand, DeviceCommandType } from "@/types/dropin";
import { useDropin } from "@/components/providers/dropin-provider";
import { errorMessage, useToast } from "@/components/ui/toast";
import { COMMAND_LABELS } from "@/lib/domain/commands";

/**
 * Sends a device command and reports its *real* outcome:
 * completed → success, pending/sent → "waiting for device", failed → error.
 */
export function useCommand() {
  const { run, device } = useDropin();
  const toast = useToast();
  const [pending, setPending] = useState<DeviceCommandType | null>(null);

  const send = useCallback(
    async (type: DeviceCommandType, payload?: Record<string, unknown>, messages?: { success?: string; description?: string }): Promise<DeviceCommand | null> => {
      if (!device) return null;
      setPending(type);
      try {
        const cmd = await run((c) => c.issueCommand(device.id, type, payload));
        if (cmd.status === "completed") toast.push({ tone: "success", title: messages?.success ?? `${COMMAND_LABELS[type]} — done`, description: messages?.description });
        else if (cmd.status === "failed") toast.push({ tone: "error", title: `${COMMAND_LABELS[type]} failed`, description: cmd.error ?? undefined });
        else toast.push({ tone: "info", title: "Waiting for your Dropin", description: device.connection_status === "online" ? "The command was sent. We'll update this when the device confirms." : "The device is offline. This change will apply when it reconnects." });
        return cmd;
      } catch (e) {
        toast.push({ tone: "error", title: `Couldn't ${COMMAND_LABELS[type].toLowerCase()}`, description: errorMessage(e) });
        return null;
      } finally {
        setPending(null);
      }
    },
    [device, run, toast],
  );

  return { send, pending };
}

import type { Device, DeviceCommand } from "@/types/dropin";
import type { DeviceGateway, DispatchOutcome } from "@/lib/backend/store";
import { sleep } from "@/lib/utils";

/**
 * Simulated hardware. Only ever used for devices flagged `is_simulated`
 * (paired with a SIM-XXXX-XXXX identifier). It confirms commands after a
 * short, realistic delay so the UI exercises its pending states.
 */
export class SimulatedGateway implements DeviceGateway {
  constructor(private latencyMs = 650) {}

  async dispatch(command: DeviceCommand, device: Device): Promise<DispatchOutcome> {
    if (!device.is_simulated) return { status: "failed", error: "Simulated gateway can't control real hardware" };
    if (device.connection_status !== "online") return { status: "pending" };
    await sleep(command.command_type === "restart_device" ? this.latencyMs * 3 : this.latencyMs);
    return { status: "completed" };
  }
}

/**
 * Real Dropin hardware. Commands are stored in `device_commands` with status
 * `pending`; the device pulls them from `GET /api/device-gateway/commands`
 * (long-poll or on its heartbeat) and confirms each one at
 * `POST /api/device-gateway/commands/{id}/ack`. Nothing is reported as done
 * until that acknowledgement arrives.
 *
 * To push instead of poll (MQTT, AWS IoT, etc.), implement `DeviceGateway`
 * and return `{ status: "sent" }` once the broker accepts the message.
 */
export class FirmwareQueueGateway implements DeviceGateway {
  async dispatch(): Promise<DispatchOutcome> {
    return { status: "pending" };
  }
}

/** Routes each command to the simulator or the firmware queue. */
export class CompositeGateway implements DeviceGateway {
  constructor(
    private simulated: DeviceGateway = new SimulatedGateway(),
    private firmware: DeviceGateway = new FirmwareQueueGateway(),
  ) {}

  dispatch(command: DeviceCommand, device: Device): Promise<DispatchOutcome> {
    return device.is_simulated ? this.simulated.dispatch(command, device) : this.firmware.dispatch(command, device);
  }
}

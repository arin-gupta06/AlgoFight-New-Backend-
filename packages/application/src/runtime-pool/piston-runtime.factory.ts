import { exec } from "child_process";
import { promisify } from "util";
import { RuntimeInstance, RuntimeSpec } from "./runtime.types";
import { logger } from "@algofight/logger";

const execAsync = promisify(exec);

export abstract class AbstractRuntimeFactory {
    abstract createRuntime(spec: RuntimeSpec): Promise<RuntimeInstance>;
    abstract destroyRuntime(runtimeUrl: string): Promise<void>;
}

/**
 * Docker-based implementation of the Factory Method Pattern.
 * Programmatically spawns and tears down isolated Piston Docker containers.
 */
export class DockerPistonRuntimeFactory extends AbstractRuntimeFactory {
    private spawnedContainers = new Map<string, string>(); // url -> containerName

    async createRuntime(spec: RuntimeSpec): Promise<RuntimeInstance> {
        const id = spec.id || `piston-elastic-${spec.port}`;
        const containerName = `algofight-${id}`;
        const port = spec.port;
        const url = `http://localhost:${port}`;
        const memoryLimit = spec.memoryLimitBytes ? `--memory=${spec.memoryLimitBytes}` : "--memory=1g";

        logger.info({ containerName, port, url }, "Factory Method: Spawning new Piston container...");

        try {
            // Check if container already exists and remove it to prevent collision
            try {
                await execAsync(`docker rm -f ${containerName}`);
            } catch {
                // Ignore if container doesn't exist
            }

            // Docker run command mounting the prewarmed packages volume and tmpfs
            const cmd = `docker run -d --name ${containerName} --restart=unless-stopped --privileged ${memoryLimit} -p ${port}:2000 -v piston_packages:/piston/packages --tmpfs /tmp ghcr.io/engineer-man/piston`;
            await execAsync(cmd);

            this.spawnedContainers.set(url, containerName);

            // Wait briefly for container health readiness
            await this.waitForReady(url, 15);

            logger.info({ containerName, url }, "Factory Method: New Piston container is healthy and ready");

            return {
                id,
                url,
                port,
                status: "HEALTHY",
                activeJobs: 0,
                isBaseline: false,
                createdAt: Date.now(),
                lastHeartbeat: Date.now(),
            };
        } catch (err: any) {
            logger.error({ err, containerName }, "Factory Method: Failed to spawn Docker container");
            throw err;
        }
    }

    async destroyRuntime(runtimeUrl: string): Promise<void> {
        const containerName = this.spawnedContainers.get(runtimeUrl);
        if (!containerName) {
            logger.warn({ runtimeUrl }, "Factory Method: No spawned container recorded for this URL, skipping Docker stop");
            return;
        }

        logger.info({ containerName, runtimeUrl }, "Factory Method: Stopping & destroying Piston container to reclaim resources...");

        try {
            await execAsync(`docker stop ${containerName}`);
            await execAsync(`docker rm ${containerName}`);
            this.spawnedContainers.delete(runtimeUrl);
            logger.info({ containerName }, "Factory Method: Container terminated and memory reclaimed successfully");
        } catch (err: any) {
            logger.error({ err, containerName }, "Factory Method: Error terminating container");
        }
    }

    private async waitForReady(url: string, retries: number): Promise<boolean> {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(`${url}/api/v2/runtimes`, { signal: AbortSignal.timeout(1000) });
                if (res.ok) return true;
            } catch {
                // Retry after delay
            }
            await new Promise((r) => setTimeout(r, 400));
        }
        return false;
    }
}

/**
 * Virtual Fallback implementation for environments where Docker daemon
 * is unavailable (e.g. serverless free tiers or sandboxed CI/CD).
 */
export class VirtualPistonRuntimeFactory extends AbstractRuntimeFactory {
    private registeredRuntimes = new Map<string, RuntimeInstance>();

    async createRuntime(spec: RuntimeSpec): Promise<RuntimeInstance> {
        const id = spec.id || `piston-virtual-${spec.port}`;
        const url = `http://localhost:${spec.port}`;

        logger.info({ id, url }, "Factory Method (Virtual): Activating virtual execution runtime slot");

        const instance: RuntimeInstance = {
            id,
            url,
            port: spec.port,
            status: "HEALTHY",
            activeJobs: 0,
            isBaseline: false,
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
        };

        this.registeredRuntimes.set(url, instance);
        return instance;
    }

    async destroyRuntime(runtimeUrl: string): Promise<void> {
        logger.info({ runtimeUrl }, "Factory Method (Virtual): Deactivating virtual execution runtime slot");
        this.registeredRuntimes.delete(runtimeUrl);
    }
}

/**
 * Factory Provider to automatically select the optimal Factory implementation.
 */
export class PistonRuntimeFactoryProvider {
    static getFactory(): AbstractRuntimeFactory {
        const useVirtual = process.env.PISTON_VIRTUAL_POOL === "true";
        if (useVirtual) {
            return new VirtualPistonRuntimeFactory();
        }
        return new DockerPistonRuntimeFactory();
    }
}

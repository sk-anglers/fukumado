"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMetricsService = void 0;
const os_1 = __importDefault(require("os"));
const process_1 = __importDefault(require("process"));
class SystemMetricsService {
    constructor() {
        this.previousCPUUsage = process_1.default.cpuUsage();
        this.previousTime = Date.now();
    }
    /**
     * システムメトリクスを取得
     */
    getSystemMetrics() {
        const cpuUsage = this.getCPUUsage();
        const memoryMetrics = this.getMemoryMetrics();
        const loadAverage = os_1.default.loadavg();
        return {
            cpu: {
                usage: cpuUsage,
                count: os_1.default.cpus().length,
                loadAverage: {
                    oneMinute: loadAverage[0],
                    fiveMinutes: loadAverage[1],
                    fifteenMinutes: loadAverage[2],
                },
            },
            memory: memoryMetrics,
            uptime: {
                systemSeconds: os_1.default.uptime(),
                processSeconds: process_1.default.uptime(),
            },
        };
    }
    /**
     * Node.jsプロセスのCPU使用率を計算（%）
     */
    getCPUUsage() {
        const currentCPUUsage = process_1.default.cpuUsage(this.previousCPUUsage);
        const currentTime = Date.now();
        const elapsedTime = currentTime - this.previousTime;
        // microseconds → milliseconds
        const totalCPUTime = (currentCPUUsage.user + currentCPUUsage.system) / 1000;
        // CPU使用率（%）= (CPU時間 / 経過時間) * 100
        const cpuPercent = (totalCPUTime / elapsedTime) * 100;
        // 次回の計算用に保存
        this.previousCPUUsage = process_1.default.cpuUsage();
        this.previousTime = currentTime;
        return Math.min(100, Math.max(0, cpuPercent));
    }
    /**
     * メモリメトリクスを取得
     */
    getMemoryMetrics() {
        const totalMemory = os_1.default.totalmem();
        const freeMemory = os_1.default.freemem();
        const usedMemory = totalMemory - freeMemory;
        const processMemory = process_1.default.memoryUsage();
        const processUsedBytes = processMemory.rss; // Resident Set Size
        return {
            totalMB: Math.round(totalMemory / 1024 / 1024),
            freeMB: Math.round(freeMemory / 1024 / 1024),
            usedMB: Math.round(usedMemory / 1024 / 1024),
            usagePercent: Math.round((usedMemory / totalMemory) * 100 * 100) / 100,
            processUsedMB: Math.round(processUsedBytes / 1024 / 1024),
            processUsagePercent: Math.round((processUsedBytes / totalMemory) * 100 * 100) / 100,
        };
    }
}
exports.SystemMetricsService = SystemMetricsService;
//# sourceMappingURL=systemMetricsService.js.map
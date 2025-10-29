"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityReporter = exports.SecurityReporter = void 0;
const anomalyDetection_1 = require("./anomalyDetection");
const security_1 = require("../middleware/security");
const metricsCollector_1 = require("./metricsCollector");
/**
 * セキュリティレポート生成サービス
 */
class SecurityReporter {
    /**
     * 日次レポートを生成
     */
    generateDailyReport() {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return this.generateReport(yesterday, now);
    }
    /**
     * 週次レポートを生成
     */
    generateWeeklyReport() {
        const now = new Date();
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return this.generateReport(lastWeek, now);
    }
    /**
     * カスタム期間のレポートを生成
     */
    generateReport(start, end) {
        console.log('[Security Reporter] Generating security report:', {
            start: start.toISOString(),
            end: end.toISOString()
        });
        // アラートデータを取得
        const allAlerts = anomalyDetection_1.anomalyDetectionService.getAlerts(1000);
        const filteredAlerts = allAlerts.filter(alert => alert.timestamp >= start && alert.timestamp <= end);
        // サマリー情報を計算
        const summary = this.calculateSummary(filteredAlerts);
        // トップ脅威IPを分析
        const topThreats = this.analyzeTopThreats(filteredAlerts);
        // アラートタイプ別の集計
        const alertsByType = this.aggregateAlertsByType(filteredAlerts);
        // 攻撃されたエンドポイントのトップ10
        const topAttackedEndpoints = this.analyzeTopAttackedEndpoints(filteredAlerts);
        // 推奨事項を生成
        const recommendations = this.generateRecommendations(summary, topThreats, alertsByType);
        const report = {
            reportId: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            generatedAt: new Date(),
            period: { start, end },
            summary,
            topThreats,
            alertsByType,
            topAttackedEndpoints,
            recommendations,
            rawAlerts: filteredAlerts.slice(0, 100) // 最大100件のアラートを含める
        };
        console.log('[Security Reporter] Report generated:', {
            reportId: report.reportId,
            totalAlerts: summary.totalAlerts,
            criticalAlerts: summary.criticalAlerts
        });
        return report;
    }
    /**
     * サマリー情報を計算
     */
    calculateSummary(alerts) {
        const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
        const highAlerts = alerts.filter(a => a.severity === 'high').length;
        const mediumAlerts = alerts.filter(a => a.severity === 'medium').length;
        const lowAlerts = alerts.filter(a => a.severity === 'low').length;
        // メトリクスから統計情報を取得
        const metricsStats = metricsCollector_1.metricsCollector.getStats();
        const errorRate = metricsStats.totalRequests > 0
            ? (metricsStats.totalErrors / metricsStats.totalRequests) * 100
            : 0;
        return {
            totalAlerts: alerts.length,
            criticalAlerts,
            highAlerts,
            mediumAlerts,
            lowAlerts,
            blockedIPs: security_1.ipBlocklist.getStats().blockedCount,
            totalRequests: metricsStats.totalRequests,
            totalErrors: metricsStats.totalErrors,
            errorRate: Math.round(errorRate * 100) / 100
        };
    }
    /**
     * トップ脅威IPを分析
     */
    analyzeTopThreats(alerts) {
        const ipStats = new Map();
        for (const alert of alerts) {
            if (alert.ip === 'multiple' || alert.ip === 'unknown')
                continue;
            const stats = ipStats.get(alert.ip) || {
                count: 0,
                lastSeen: alert.timestamp,
                types: new Set()
            };
            stats.count++;
            if (alert.timestamp > stats.lastSeen) {
                stats.lastSeen = alert.timestamp;
            }
            stats.types.add(alert.type);
            ipStats.set(alert.ip, stats);
        }
        // トップ10を抽出
        const topThreats = Array.from(ipStats.entries())
            .map(([ip, stats]) => ({
            ip,
            alertCount: stats.count,
            lastSeen: stats.lastSeen,
            threatTypes: Array.from(stats.types)
        }))
            .sort((a, b) => b.alertCount - a.alertCount)
            .slice(0, 10);
        return topThreats;
    }
    /**
     * アラートタイプ別に集計
     */
    aggregateAlertsByType(alerts) {
        const typeCount = {};
        for (const alert of alerts) {
            typeCount[alert.type] = (typeCount[alert.type] || 0) + 1;
        }
        return typeCount;
    }
    /**
     * 攻撃されたエンドポイントのトップ10を分析
     */
    analyzeTopAttackedEndpoints(alerts) {
        const endpointCount = new Map();
        for (const alert of alerts) {
            if (alert.type === 'unusual_endpoint' && alert.metadata.endpoint) {
                const endpoint = alert.metadata.endpoint;
                endpointCount.set(endpoint, (endpointCount.get(endpoint) || 0) + 1);
            }
        }
        return Array.from(endpointCount.entries())
            .map(([endpoint, count]) => ({ endpoint, attackCount: count }))
            .sort((a, b) => b.attackCount - a.attackCount)
            .slice(0, 10);
    }
    /**
     * 推奨事項を生成
     */
    generateRecommendations(summary, topThreats, alertsByType) {
        const recommendations = [];
        // クリティカルアラートが多い場合
        if (summary.criticalAlerts > 10) {
            recommendations.push(`⚠️ ${summary.criticalAlerts}件のクリティカルアラートが検出されました。即座に対応が必要です。`);
        }
        // エラー率が高い場合
        if (summary.errorRate > 10) {
            recommendations.push(`⚠️ エラー率が${summary.errorRate}%と高い状態です。アプリケーションの安定性を確認してください。`);
        }
        // トラフィック急増が多い場合
        if (alertsByType['traffic_spike'] > 5) {
            recommendations.push(`📈 トラフィック急増が${alertsByType['traffic_spike']}回検出されました。スケーリング設定を見直してください。`);
        }
        // 不審なアクティビティが多い場合
        if (alertsByType['suspicious_pattern'] > 10) {
            recommendations.push(`🚨 不審なアクティビティが${alertsByType['suspicious_pattern']}件検出されました。IPブロックリストの強化を検討してください。`);
        }
        // 認証失敗が多い場合
        if (alertsByType['failed_auth'] > 20) {
            recommendations.push(`🔐 認証失敗が${alertsByType['failed_auth']}件検出されました。ブルートフォース攻撃の可能性があります。2要素認証の導入を検討してください。`);
        }
        // 特定のIPからの攻撃が集中している場合
        if (topThreats.length > 0 && topThreats[0].alertCount > 50) {
            recommendations.push(`🎯 IP ${topThreats[0].ip} から ${topThreats[0].alertCount}件の脅威が検出されています。このIPを永久ブロックすることを検討してください。`);
        }
        // ブロック済みIPが多い場合
        if (summary.blockedIPs > 100) {
            recommendations.push(`🔒 ${summary.blockedIPs}個のIPがブロックされています。地理的フィルタリングやCDN経由のトラフィックフィルタリングを検討してください。`);
        }
        // 推奨事項がない場合
        if (recommendations.length === 0) {
            recommendations.push('✅ セキュリティ状況は良好です。現在の対策を継続してください。');
        }
        return recommendations;
    }
    /**
     * レポートをJSON形式でエクスポート
     */
    exportJSON(report) {
        return JSON.stringify(report, null, 2);
    }
    /**
     * レポートをCSV形式でエクスポート（アラート一覧）
     */
    exportCSV(report) {
        const lines = [];
        // ヘッダー
        lines.push('Timestamp,Severity,Type,IP,Description');
        // アラート情報
        for (const alert of report.rawAlerts) {
            const timestamp = alert.timestamp.toISOString();
            const severity = alert.severity;
            const type = alert.type;
            const ip = alert.ip;
            const description = alert.description.replace(/,/g, ';'); // カンマをセミコロンに置換
            lines.push(`${timestamp},${severity},${type},${ip},"${description}"`);
        }
        return lines.join('\n');
    }
    /**
     * レポートをMarkdown形式でエクスポート
     */
    exportMarkdown(report) {
        const lines = [];
        lines.push(`# セキュリティレポート`);
        lines.push(`**Report ID:** ${report.reportId}`);
        lines.push(`**生成日時:** ${report.generatedAt.toLocaleString('ja-JP')}`);
        lines.push(`**期間:** ${report.period.start.toLocaleString('ja-JP')} - ${report.period.end.toLocaleString('ja-JP')}`);
        lines.push('');
        lines.push('## サマリー');
        lines.push('');
        lines.push(`- **総アラート数:** ${report.summary.totalAlerts}件`);
        lines.push(`- **クリティカル:** ${report.summary.criticalAlerts}件`);
        lines.push(`- **高:** ${report.summary.highAlerts}件`);
        lines.push(`- **中:** ${report.summary.mediumAlerts}件`);
        lines.push(`- **低:** ${report.summary.lowAlerts}件`);
        lines.push(`- **ブロック済みIP:** ${report.summary.blockedIPs}個`);
        lines.push(`- **総リクエスト数:** ${report.summary.totalRequests.toLocaleString()}件`);
        lines.push(`- **エラー数:** ${report.summary.totalErrors.toLocaleString()}件`);
        lines.push(`- **エラー率:** ${report.summary.errorRate}%`);
        lines.push('');
        if (report.topThreats.length > 0) {
            lines.push('## トップ脅威IP');
            lines.push('');
            lines.push('| IP | アラート数 | 最終検出 | 脅威タイプ |');
            lines.push('|----|-----------|----------|-----------|');
            for (const threat of report.topThreats) {
                lines.push(`| ${threat.ip} | ${threat.alertCount} | ${threat.lastSeen.toLocaleString('ja-JP')} | ${threat.threatTypes.join(', ')} |`);
            }
            lines.push('');
        }
        if (Object.keys(report.alertsByType).length > 0) {
            lines.push('## アラートタイプ別集計');
            lines.push('');
            lines.push('| タイプ | 件数 |');
            lines.push('|--------|------|');
            for (const [type, count] of Object.entries(report.alertsByType).sort((a, b) => b[1] - a[1])) {
                lines.push(`| ${type} | ${count} |`);
            }
            lines.push('');
        }
        if (report.topAttackedEndpoints.length > 0) {
            lines.push('## 攻撃されたエンドポイント（トップ10）');
            lines.push('');
            lines.push('| エンドポイント | 攻撃回数 |');
            lines.push('|---------------|---------|');
            for (const endpoint of report.topAttackedEndpoints) {
                lines.push(`| ${endpoint.endpoint} | ${endpoint.attackCount} |`);
            }
            lines.push('');
        }
        lines.push('## 推奨事項');
        lines.push('');
        for (const recommendation of report.recommendations) {
            lines.push(`- ${recommendation}`);
        }
        lines.push('');
        return lines.join('\n');
    }
    /**
     * サマリー情報のみを取得（軽量版）
     */
    getQuickSummary() {
        const anomalyStats = anomalyDetection_1.anomalyDetectionService.getStats();
        const metricsStats = metricsCollector_1.metricsCollector.getStats();
        const errorRate = metricsStats.totalRequests > 0
            ? (metricsStats.totalErrors / metricsStats.totalRequests) * 100
            : 0;
        const criticalIssues = anomalyStats.alertsBySeverity['critical'] || 0;
        const highPriorityIssues = anomalyStats.alertsBySeverity['high'] || 0;
        let status = 'healthy';
        if (criticalIssues > 0 || errorRate > 20) {
            status = 'critical';
        }
        else if (highPriorityIssues > 5 || errorRate > 10) {
            status = 'warning';
        }
        return {
            criticalIssues,
            highPriorityIssues,
            blockedIPs: security_1.ipBlocklist.getStats().blockedCount,
            errorRate: Math.round(errorRate * 100) / 100,
            status
        };
    }
}
exports.SecurityReporter = SecurityReporter;
// シングルトンインスタンス
exports.securityReporter = new SecurityReporter();
//# sourceMappingURL=securityReporter.js.map
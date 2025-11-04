'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ComponentHealth {
  name: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
  latency?: number;
  lastChecked: string;
  error?: string;
  statusCode?: number;
  responseBody?: string;
  errorType?: 'timeout' | 'http_error' | 'network_error' | 'parse_error' | 'unknown';
  uptime: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  history?: Array<{
    timestamp: string;
    status: string;
    latency?: number;
    error?: string;
  }>;
}

interface HealthCheckResult {
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  timestamp: string;
  components: ComponentHealth[];
  uptime: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

interface Incident {
  start: string;
  end?: string;
  components: string[];
  status: string;
  error?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'operational':
      return 'text-emerald-400';
    case 'degraded':
      return 'text-yellow-400';
    case 'partial_outage':
      return 'text-orange-400';
    case 'major_outage':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getStatusBg = (status: string) => {
  switch (status) {
    case 'operational':
      return 'bg-emerald-500/10 border-emerald-500/20';
    case 'degraded':
      return 'bg-yellow-500/10 border-yellow-500/20';
    case 'partial_outage':
      return 'bg-orange-500/10 border-orange-500/20';
    case 'major_outage':
      return 'bg-red-500/10 border-red-500/20';
    default:
      return 'bg-gray-500/10 border-gray-500/20';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'operational':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    case 'degraded':
      return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    case 'partial_outage':
      return <XCircle className="w-5 h-5 text-orange-400" />;
    case 'major_outage':
      return <XCircle className="w-5 h-5 text-red-400" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-400" />;
  }
};

const formatUptime = (percentage: number) => {
  return `${percentage.toFixed(2)}%`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Component for time-based visualization
function TimelineChart({ history }: { history?: ComponentHealth['history'] }) {
  if (!history || history.length === 0) {
    return <div className="text-sm text-gray-400">No history available</div>;
  }

  const points = history.slice(-24); // Last 24 checks (1 hour if checking every minute)

  return (
    <div className="mt-4">
      <div className="text-xs text-gray-400 mb-2">Status over time (last 24 checks)</div>
      <div className="flex items-end gap-1 h-16">
        {points.map((point, idx) => {
          const height =
            point.status === 'operational' ? 100 : point.status === 'degraded' ? 60 : 30;
          const bgColor =
            point.status === 'operational'
              ? 'bg-emerald-500'
              : point.status === 'degraded'
                ? 'bg-yellow-500'
                : point.status === 'partial_outage'
                  ? 'bg-orange-500'
                  : 'bg-red-500';

          return (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full ${bgColor} rounded-t transition-all`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{formatTime(points[0]?.timestamp || '')}</span>
        <span>{formatTime(points[points.length - 1]?.timestamp || '')}</span>
      </div>
    </div>
  );
}

function ComponentCard({
  component,
  expanded,
  onToggle,
}: {
  component: ComponentHealth;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${getStatusBg(component.status)} rounded-lg border transition-colors`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {getStatusIcon(component.status)}
            <div className="flex-1">
              <div className="font-medium">{component.name}</div>
              <div className="text-sm text-gray-400 mt-1">
                {component.latency !== undefined ? `${component.latency}ms` : 'N/A'}
                {component.statusCode && ` • HTTP ${component.statusCode}`}
                {component.errorType && ` • ${component.errorType.replace('_', ' ')}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">Uptime (24h)</div>
              <div
                className={`text-sm font-medium ${component.uptime.last24h > 99 ? 'text-emerald-400' : component.uptime.last24h > 95 ? 'text-yellow-400' : 'text-red-400'}`}
              >
                {formatUptime(component.uptime.last24h)}
              </div>
            </div>
            <button onClick={onToggle} className="p-2 hover:bg-white/5 rounded transition-colors">
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
            {/* Error Details */}
            {component.error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-400 mb-1">Error Details</div>
                    <div className="text-xs text-gray-300 font-mono break-all">
                      {component.error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Response Body */}
            {component.responseBody && (
              <div className="bg-gray-900/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Response Preview</div>
                <div className="text-xs text-gray-300 font-mono break-all">
                  {component.responseBody}
                </div>
              </div>
            )}

            {/* Time-based Visualization */}
            <TimelineChart history={component.history} />

            {/* Uptime Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <div className="text-xs text-gray-400 mb-1">Last 24h</div>
                <div
                  className={`text-sm font-medium ${component.uptime.last24h > 99 ? 'text-emerald-400' : component.uptime.last24h > 95 ? 'text-yellow-400' : 'text-red-400'}`}
                >
                  {formatUptime(component.uptime.last24h)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Last 7d</div>
                <div
                  className={`text-sm font-medium ${component.uptime.last7d > 99 ? 'text-emerald-400' : component.uptime.last7d > 95 ? 'text-yellow-400' : 'text-red-400'}`}
                >
                  {formatUptime(component.uptime.last7d)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Last 30d</div>
                <div
                  className={`text-sm font-medium ${component.uptime.last30d > 99 ? 'text-emerald-400' : component.uptime.last30d > 95 ? 'text-yellow-400' : 'text-red-400'}`}
                >
                  {formatUptime(component.uptime.last30d)}
                </div>
              </div>
            </div>

            {/* Last Checked */}
            <div className="text-xs text-gray-400">
              Last checked: {formatDate(component.lastChecked)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [status, setStatus] = useState<HealthCheckResult | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  const fetchStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const [statusRes, incidentsRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/status`),
        fetch(`${apiUrl}/api/v1/status/incidents`),
      ]);

      if (!statusRes.ok) {
        throw new Error('Failed to fetch status');
      }

      const statusData = await statusRes.json();
      const incidentsData = await incidentsRes.json();

      setStatus(statusData);
      setIncidents(incidentsData.incidents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
      console.error('Error fetching status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleComponent = (componentName: string) => {
    const newExpanded = new Set(expandedComponents);
    if (newExpanded.has(componentName)) {
      newExpanded.delete(componentName);
    } else {
      newExpanded.add(componentName);
    }
    setExpandedComponents(newExpanded);
  };

  // Group components by category (extract from name or use "Other")
  const componentsByCategory =
    status?.components.reduce(
      (acc, component) => {
        // Extract category from component name (e.g., "Prices - ACES/USD" -> "Prices")
        const category = component.name.split(' - ')[0] || 'Other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(component);
        return acc;
      },
      {} as Record<string, ComponentHealth[]>,
    ) || {};

  const categories = Object.keys(componentsByCategory).sort();

  const filteredComponents =
    status?.components.filter((comp) => {
      if (showOnlyIssues) {
        return comp.status !== 'operational';
      }
      return true;
    }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-gray-400">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Failed to Load Status</h2>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={fetchStatus}
            className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const issuesCount = status.components.filter((c) => c.status !== 'operational').length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">ACES.fun Status</h1>
              <p className="text-gray-400">Real-time API endpoint health monitoring</p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${getStatusColor(status.status)}`}>
                {getStatusIcon(status.status)}
                <span className="text-sm font-medium capitalize">
                  {status.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Uptime Metrics */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Uptime</h2>
            {issuesCount > 0 && (
              <div className="text-sm text-red-400">
                {issuesCount} {issuesCount === 1 ? 'issue' : 'issues'} detected
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">Last 24 hours</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatUptime(status.uptime.last24h)}
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">Last 7 days</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatUptime(status.uptime.last7d)}
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">Last 30 days</div>
              <div className="text-2xl font-bold text-emerald-400">
                {formatUptime(status.uptime.last30d)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyIssues}
                onChange={(e) => setShowOnlyIssues(e.target.checked)}
                className="rounded"
              />
              Show only issues
            </label>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-xl font-semibold mb-4">
          All Systems ({status.components.length} endpoints)
        </h2>
        <div className="space-y-3">
          {(showOnlyIssues ? filteredComponents : status.components).map((component) => (
            <ComponentCard
              key={component.name}
              component={component}
              expanded={expandedComponents.has(component.name)}
              onToggle={() => toggleComponent(component.name)}
            />
          ))}
        </div>
      </div>

      {/* Incident History */}
      {incidents.length > 0 && (
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h2 className="text-xl font-semibold mb-4">Past Incidents</h2>
            <div className="space-y-4">
              {incidents.slice(0, 10).map((incident, index) => (
                <div key={index} className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium mb-1">
                        {incident.components.join(', ')} - {incident.status.replace('_', ' ')}
                      </div>
                      {incident.error && (
                        <div className="text-sm text-red-400 mb-2 font-mono">{incident.error}</div>
                      )}
                      <div className="text-sm text-gray-400">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Started: {formatDate(incident.start)}
                        {incident.end && ` • Ended: ${formatDate(incident.end)}`}
                        {!incident.end && ' • Ongoing'}
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusBg(incident.status)} ${getStatusColor(incident.status)}`}
                    >
                      {incident.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>Last updated: {formatDate(status.timestamp)}</div>
            <div>Auto-refreshing every 30 seconds</div>
          </div>
        </div>
      </div>
    </div>
  );
}
